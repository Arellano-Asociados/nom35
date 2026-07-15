'use server';

import { EVENTOS_AUDITORIA, registrarAuditoria } from '@/lib/auditoria';
import { autorizarEmpresa, empresaOperable, puedeGestionar } from '@/lib/autorizacion';
import { FLAGS, flagActiva } from '@/lib/flags';
import { armarInsumoPlan, armarInsumoResumen } from '@/lib/ia/ia-datos';
import { PROMPT_PLAN_V1, PROMPT_RESUMEN_V1, VERSION_PLAN, VERSION_RESUMEN } from '@/lib/ia/prompts';
import { proveedorIA } from '@/lib/ia/proveedor';
import { validarPlan, validarResumen, type MedidaPlan } from '@/lib/ia/validar-salida';
import { permitido } from '@/lib/limites';
import { clienteSesion } from '@/lib/supabase-servidor';

// Acciones de asistencia por IA (Fase 6). La IA propone; el humano dispone y firma. El
// gating es idéntico para resumen y plan: gestión + tenant activo + flag ia_asistida +
// limitador FAIL-CLOSED por ciclo (el límite ES la protección de costo: con el limitador
// caído, permitir sería llamadas ilimitadas a una API que cobra por token). El insumo lo
// arma la allow-list ia-datos (agregados ya suprimidos); el INSERT del borrador es del
// USUARIO con su sesión (RLS + generated_by = auth.uid()).

export interface ResultadoIaGenerar {
  ok: boolean;
  error?: string;
  draftId?: string;
}

export interface ResultadoIaAccion {
  ok: boolean;
  error?: string;
}

const SIN_PERMISO =
  'Tu rol no permite esta acción. Pídele al Administrador de la organización que la realice o que te asigne el permiso.';

interface Gating {
  userId: string;
}

/** Puerta común de generación: gestión + tenant activo + flag + limitador fail-closed. */
async function puertaGeneracion(
  companyId: string,
  cycleId: string,
): Promise<Gating | { error: string }> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { error: SIN_PERMISO };
  const operable = empresaOperable(acceso.membresia);
  if (!operable.ok) return { error: operable.error };
  if (!(await flagActiva(companyId, FLAGS.iaAsistida, false))) {
    return { error: 'La asistencia por IA no está habilitada para esta organización.' };
  }
  // FAIL-CLOSED: la generación cuesta dinero; sin limitador disponible, no se genera.
  const permitida = await permitido(`ia:${cycleId}`, {
    ventanaSegundos: 86_400,
    maximo: 10,
    alFallar: 'rechazar',
  });
  if (!permitida) {
    return {
      error: 'Alcanzaste el límite de generaciones de hoy para este ciclo. Intenta mañana.',
    };
  }
  const prov = proveedorIA();
  if (!prov.disponible()) {
    return { error: 'La generación asistida por IA no está configurada en este entorno.' };
  }
  return { userId: acceso.userId };
}

export async function accionGenerarResumen(
  companyId: string,
  cycleId: string,
): Promise<ResultadoIaGenerar> {
  const puerta = await puertaGeneracion(companyId, cycleId);
  if ('error' in puerta) return { ok: false, error: puerta.error };

  const { insumoJson, insumoSha256 } = await armarInsumoResumen(companyId, cycleId);
  let respuesta;
  try {
    respuesta = await proveedorIA().generar({
      system: PROMPT_RESUMEN_V1,
      insumoJson,
      maxTokens: 1200,
    });
  } catch {
    return { ok: false, error: 'No se pudo generar el borrador. Intenta de nuevo.' };
  }
  const validacion = validarResumen(respuesta.texto);
  if (!validacion.ok) {
    return { ok: false, error: 'El borrador generado no tuvo el formato esperado. Reintenta.' };
  }

  const draftId = await persistirBorrador({
    companyId,
    cycleId,
    userId: puerta.userId,
    tipo: 'resumen_ejecutivo',
    texto: respuesta.texto,
    modelo: respuesta.modelo,
    promptVersion: VERSION_RESUMEN,
    insumoJson,
    insumoSha256,
  });
  if (!draftId) return { ok: false, error: 'No se pudo guardar el borrador.' };
  return { ok: true, draftId };
}

export interface ResultadoIaPlan {
  ok: boolean;
  error?: string;
  draftId?: string;
  medidas?: MedidaPlan[];
}

export async function accionGenerarPlan(
  companyId: string,
  cycleId: string,
): Promise<ResultadoIaPlan> {
  const puerta = await puertaGeneracion(companyId, cycleId);
  if ('error' in puerta) return { ok: false, error: puerta.error };

  const { insumo, insumoJson, insumoSha256 } = await armarInsumoPlan(companyId, cycleId);
  const anclas =
    insumo.catalogoAcciones?.exigenPrograma.flatMap(
      (nivel) =>
        insumo.catalogoAcciones?.niveles[nivel]?.accionesSugeridas.map((a) => a.descripcion) ?? [],
    ) ?? [];

  let respuesta;
  try {
    respuesta = await proveedorIA().generar({
      system: PROMPT_PLAN_V1,
      insumoJson,
      maxTokens: 2000,
    });
  } catch {
    return { ok: false, error: 'No se pudo generar el borrador. Intenta de nuevo.' };
  }
  const validacion = validarPlan(respuesta.texto, anclas);
  if (!validacion.ok) {
    return { ok: false, error: 'El borrador generado no tuvo el formato esperado. Reintenta.' };
  }

  const draftId = await persistirBorrador({
    companyId,
    cycleId,
    userId: puerta.userId,
    tipo: 'plan_accion',
    texto: respuesta.texto,
    modelo: respuesta.modelo,
    promptVersion: VERSION_PLAN,
    insumoJson,
    insumoSha256,
  });
  if (!draftId) return { ok: false, error: 'No se pudo guardar el borrador.' };
  return { ok: true, draftId, medidas: validacion.medidas };
}

async function persistirBorrador(args: {
  companyId: string;
  cycleId: string;
  userId: string;
  tipo: 'resumen_ejecutivo' | 'plan_accion';
  texto: string;
  modelo: string;
  promptVersion: string;
  insumoJson: string;
  insumoSha256: string;
}): Promise<string | null> {
  const supabase = await clienteSesion();
  const { data, error } = await supabase
    .from('ai_drafts')
    .insert({
      company_id: args.companyId,
      cycle_id: args.cycleId,
      tipo: args.tipo,
      texto: args.texto,
      modelo: args.modelo,
      prompt_version: args.promptVersion,
      insumo: JSON.parse(args.insumoJson),
      insumo_sha256: args.insumoSha256,
      generated_by: args.userId,
    })
    .select('id')
    .single();
  if (error || !data) return null;

  await registrarAuditoria(
    args.companyId,
    args.userId,
    EVENTOS_AUDITORIA.iaBorradorGenerado,
    'ai_drafts',
    data.id,
    {
      tipo: args.tipo,
      modelo: args.modelo,
      prompt_version: args.promptVersion,
      insumo_sha256: args.insumoSha256,
    },
  );
  return data.id;
}

/**
 * Adopción: el usuario revisa y hace SUYO el borrador. Solo el más reciente del ciclo y
 * tipo puede adoptarse; el trigger app.solo_adopcion lo hace de una sola vía.
 */
export async function accionAdoptarBorrador(
  companyId: string,
  draftId: string,
): Promise<ResultadoIaAccion> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: SIN_PERMISO };

  const supabase = await clienteSesion();
  const { data, error } = await supabase
    .from('ai_drafts')
    .update({ adopted_by: acceso.userId, adopted_at: new Date().toISOString() })
    .eq('id', draftId)
    .eq('company_id', companyId)
    .is('adopted_at', null)
    .select('id, tipo')
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: 'No se pudo adoptar el borrador (¿ya estaba adoptado?).' };
  }

  await registrarAuditoria(
    companyId,
    acceso.userId,
    EVENTOS_AUDITORIA.iaBorradorAdoptado,
    'ai_drafts',
    draftId,
    { tipo: data.tipo },
  );
  return { ok: true };
}

const NIVELES_ORIGEN = ['nulo', 'bajo', 'medio', 'alto', 'muy_alto'];
const NIVELES_ACCION = ['primer_nivel', 'segundo_nivel', 'tercer_nivel'];

export interface MedidaAdoptada {
  descripcion: string;
  nivelOrigen: string;
  nivelAccion: string | null;
}

/**
 * Adopción del plan EN EL PROGRAMA (spec §6): las medidas seleccionadas y editadas por el
 * usuario se insertan como action_items con ai_assisted = true, CON LA SESIÓN del usuario
 * (RLS). La IA jamás escribe en el programa: el INSERT es del cliente, como siempre. Marca
 * el borrador adoptado (una sola vía) antes de insertar, así el reintento no duplica.
 */
export async function accionAdoptarPlanEnPrograma(
  companyId: string,
  cycleId: string,
  draftId: string,
  medidas: MedidaAdoptada[],
): Promise<ResultadoIaAccion> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: SIN_PERMISO };
  const operable = empresaOperable(acceso.membresia);
  if (!operable.ok) return { ok: false, error: operable.error };
  const seleccionadas = medidas.filter((m) => m.descripcion.trim() !== '');
  if (seleccionadas.length === 0) {
    return { ok: false, error: 'Selecciona al menos una medida para adoptar.' };
  }

  const supabase = await clienteSesion();
  // Adopción de una sola vía primero: si ya estaba adoptado, no se reinsertan acciones.
  const { data: adoptado, error: errorAdopcion } = await supabase
    .from('ai_drafts')
    .update({ adopted_by: acceso.userId, adopted_at: new Date().toISOString() })
    .eq('id', draftId)
    .eq('company_id', companyId)
    .is('adopted_at', null)
    .select('id')
    .maybeSingle();
  if (errorAdopcion || !adoptado) {
    return { ok: false, error: 'No se pudo adoptar el borrador (¿ya estaba adoptado?).' };
  }

  const { data: programa } = await supabase
    .from('intervention_programs')
    .select('id')
    .eq('company_id', companyId)
    .eq('cycle_id', cycleId)
    .maybeSingle();

  const filas = seleccionadas.map((m) => ({
    company_id: companyId,
    cycle_id: cycleId,
    program_id: programa?.id ?? null,
    description: m.descripcion.trim(),
    origin_level: NIVELES_ORIGEN.includes(m.nivelOrigen) ? m.nivelOrigen : 'medio',
    responsible: acceso.email || 'Por asignar',
    action_level: m.nivelAccion && NIVELES_ACCION.includes(m.nivelAccion) ? m.nivelAccion : null,
    ai_assisted: true,
  }));
  const { error: errorInsert } = await supabase.from('action_items').insert(filas);
  if (errorInsert) {
    return {
      ok: false,
      error:
        'El borrador se adoptó pero no se pudieron crear todas las acciones. Revisa el programa.',
    };
  }

  await registrarAuditoria(
    companyId,
    acceso.userId,
    EVENTOS_AUDITORIA.iaBorradorAdoptado,
    'ai_drafts',
    draftId,
    { tipo: 'plan_accion', acciones: filas.length },
  );
  return { ok: true };
}
