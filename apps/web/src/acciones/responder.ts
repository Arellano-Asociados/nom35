'use server';

import { GR2, GR3 } from '@nom35/motor-nom035';
import { headers } from 'next/headers';
import { enviarCuestionario, obtenerContexto, type Contexto } from '@/lib/flujo';
import { registrarAuditoria } from '@/lib/auditoria';
import { avisoVigenteDe } from '@/lib/aviso-privacidad';
import { escrituraOk } from '@/lib/escrituras';
import { ACTOR_SISTEMA } from '@/lib/recordatorios';
import { ipCliente, permitido } from '@/lib/limites';
import { clienteAdmin } from '@/lib/supabase-admin';
import { hashDeToken } from '@/lib/tokens';

// Acciones del flujo del empleado. El token del enlace es la capacidad: se re-valida en
// CADA acción (existencia, vigencia, estado). Nunca se confía en datos del cliente.

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

const OPCIONES_LIKERT = ['siempre', 'casi_siempre', 'algunas_veces', 'casi_nunca', 'nunca'];

async function contextoActivo(token: string): Promise<Contexto | { error: string }> {
  // Límite por TOKEN, no por IP (Fase 2.5): una oficina entera comparte IP mientras
  // responde en paralelo. 2,500/hora sobra para un cuestionario legítimo (≤~400
  // escrituras) y frena martilleo automatizado sobre un mismo enlace. La fuerza
  // bruta de tokens INVÁLIDOS se limita aparte, por IP, en la página del enlace.
  const clave = `token:${hashDeToken(token).slice(0, 16)}`;
  if (!(await permitido(clave, { ventanaSegundos: 3600, maximo: 2500 }))) {
    return { error: 'Demasiadas operaciones con este enlace. Espera unos minutos.' };
  }
  const ctx = await obtenerContexto(token);
  if (!ctx) {
    // Un token que NO existe también cuenta contra la IP: es la señal de adivinación.
    const ip = await ipCliente();
    await permitido(`token-miss:${ip}`, { ventanaSegundos: 600, maximo: 30 });
    return { error: 'Enlace inválido' };
  }
  if (ctx.completado) return { error: 'Este cuestionario ya fue enviado' };
  if (ctx.expirado) return { error: 'Este enlace ha expirado' };
  return ctx;
}

export async function accionRegistrarConsentimiento(token: string): Promise<ResultadoAccion> {
  const ctx = await contextoActivo(token);
  if ('error' in ctx) return { ok: false, error: ctx.error };
  if (ctx.consentido) return { ok: true };

  const encabezados = await headers();
  const ip = encabezados.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  // El consentimiento apunta a la FILA del aviso archivado, no solo a su etiqueta: es lo
  // que permite exhibir años después el texto exacto que el titular aceptó.
  const aviso = await avisoVigenteDe(ctx.companyId, ctx.empresa.razonSocial);

  const guardado = await escrituraOk(
    'registrar consentimiento',
    clienteAdmin().from('consents').insert({
      company_id: ctx.companyId,
      assignment_id: ctx.asignacionId,
      employee_id: ctx.employeeId,
      privacy_text_version: aviso.version,
      privacy_notice_id: aviso.id,
      ip,
    }),
  );
  if (!guardado.ok) return { ok: false, error: 'No se pudo registrar el consentimiento' };
  return { ok: true };
}

export async function accionGuardarFiltros(
  token: string,
  atiendeClientes: boolean,
  supervisaPersonal: boolean,
): Promise<ResultadoAccion> {
  const ctx = await contextoActivo(token);
  if ('error' in ctx) return { ok: false, error: ctx.error };
  if (!ctx.consentido) return { ok: false, error: 'Falta el consentimiento' };

  const supabase = clienteAdmin();
  const { error: errorEmpleado } = await supabase
    .from('employees')
    .update({
      attends_customers: Boolean(atiendeClientes),
      supervises_others: Boolean(supervisaPersonal),
    })
    .eq('id', ctx.employeeId);
  if (errorEmpleado) return { ok: false, error: 'No se pudieron guardar las preguntas filtro' };

  const { error } = await supabase
    .from('questionnaire_assignments')
    .update({ filters_captured_at: new Date().toISOString() })
    .eq('id', ctx.asignacionId);
  if (error) return { ok: false, error: 'No se pudieron guardar las preguntas filtro' };
  return { ok: true };
}

export async function accionGuardarRespuesta(
  token: string,
  seccion: string | null,
  numeroItem: number,
  respuesta: string,
): Promise<ResultadoAccion> {
  const ctx = await contextoActivo(token);
  if ('error' in ctx) return { ok: false, error: ctx.error };
  if (!ctx.consentido) return { ok: false, error: 'Falta el consentimiento' };

  if (!Number.isInteger(numeroItem) || numeroItem < 1) {
    return { ok: false, error: 'Ítem inválido' };
  }

  if (ctx.guia === 'GR-I') {
    if (!['I', 'II', 'III', 'IV'].includes(seccion ?? '')) {
      return { ok: false, error: 'Sección inválida' };
    }
    if (respuesta !== 'si' && respuesta !== 'no') {
      return { ok: false, error: 'Respuesta inválida' };
    }
  } else {
    const guia = ctx.guia === 'GR-II' ? GR2 : GR3;
    if (seccion !== null) return { ok: false, error: 'Sección inválida' };
    if (numeroItem > guia.totalItems) return { ok: false, error: 'Ítem inválido' };
    if (!OPCIONES_LIKERT.includes(respuesta)) return { ok: false, error: 'Respuesta inválida' };
    if (!ctx.filtrosCapturados) return { ok: false, error: 'Faltan las preguntas filtro' };
    const noAplican = new Set<number>([
      ...(ctx.empleado.atiendeClientes ? [] : guia.itemsCondicionales.atiendeClientes),
      ...(ctx.empleado.supervisaPersonal ? [] : guia.itemsCondicionales.supervisaPersonal),
    ]);
    if (noAplican.has(numeroItem)) {
      return { ok: false, error: 'Esta pregunta no aplica para tu puesto.' };
    }
  }

  const { error } = await clienteAdmin().from('responses').insert({
    company_id: ctx.companyId,
    assignment_id: ctx.asignacionId,
    section: seccion,
    item_number: numeroItem,
    answer: respuesta,
  });
  if (error) return { ok: false, error: 'No se pudo guardar la respuesta' };
  return { ok: true };
}

export async function accionEnviarCuestionario(token: string): Promise<ResultadoAccion> {
  const ctx = await contextoActivo(token);
  if ('error' in ctx) return { ok: false, error: ctx.error };
  if (!ctx.consentido) return { ok: false, error: 'Falta el consentimiento' };
  if (ctx.guia !== 'GR-I' && !ctx.filtrosCapturados) {
    return { ok: false, error: 'Faltan las preguntas filtro' };
  }

  const resultado = await enviarCuestionario(ctx);
  if (resultado.error) return { ok: false, error: resultado.error };
  return { ok: true };
}

/**
 * Acuse "Enterado" del trabajador sobre una constancia de difusión de resultados
 * (5.7 e / 7.8). Como el acuse de política: puede ocurrir con el cuestionario ya
 * enviado, pero jamás con un enlace vencido.
 */
export async function accionAcusarDifusion(
  token: string,
  disseminationId: string,
): Promise<ResultadoAccion> {
  const ctx = await obtenerContexto(token);
  if (!ctx) return { ok: false, error: 'Enlace inválido' };
  if (ctx.expirado) return { ok: false, error: 'Este enlace ha expirado' };
  if (!ctx.consentido) return { ok: false, error: 'Falta el consentimiento' };

  const supabase = clienteAdmin();
  const { data: difusion } = await supabase
    .from('dissemination_records')
    .select('id')
    .eq('company_id', ctx.companyId)
    .eq('id', disseminationId)
    .maybeSingle();
  if (!difusion) return { ok: false, error: 'Constancia no encontrada' };

  // Acuse idempotente: volver a pulsar no duplica (unique dissemination+employee).
  const { data: existente } = await supabase
    .from('dissemination_receipts')
    .select('id')
    .eq('dissemination_id', disseminationId)
    .eq('employee_id', ctx.employeeId)
    .maybeSingle();
  if (existente) return { ok: true };

  const guardado = await escrituraOk(
    'acuse de difusión de resultados',
    supabase.from('dissemination_receipts').insert({
      company_id: ctx.companyId,
      dissemination_id: disseminationId,
      employee_id: ctx.employeeId,
    }),
  );
  if (!guardado.ok) {
    return { ok: false, error: 'No se pudo registrar tu acuse. Intenta de nuevo.' };
  }

  await registrarAuditoria(
    ctx.companyId,
    ACTOR_SISTEMA,
    'difusion_acusada',
    'dissemination_receipts',
    undefined,
    { disseminationId },
  );
  return { ok: true };
}

/** Acuse de recibo de la política de prevención por el empleado (evidencia de difusión). */
export async function accionAcusarPolitica(
  token: string,
  policyId: string,
): Promise<ResultadoAccion> {
  // No usa contextoActivo porque el acuse SÍ puede ocurrir con el cuestionario ya
  // enviado; pero un enlace vencido no debe poder escribir evidencia (auditoría v0).
  const ctx = await obtenerContexto(token);
  if (!ctx) return { ok: false, error: 'Enlace inválido' };
  if (ctx.expirado) return { ok: false, error: 'Este enlace ha expirado' };
  if (!ctx.consentido) return { ok: false, error: 'Falta el consentimiento' };

  const supabase = clienteAdmin();
  const { data: politica } = await supabase
    .from('policies')
    .select('id')
    .eq('company_id', ctx.companyId)
    .eq('id', policyId)
    .maybeSingle();
  if (!politica) return { ok: false, error: 'Política no encontrada' };

  // El acuse es EVIDENCIA DE DIFUSIÓN exhibible ante la STPS: si el insert falla, el
  // trabajador debe ver un error, jamás un "listo" sobre una fila que no existe.
  const guardado = await escrituraOk(
    'acuse de política',
    supabase.from('policy_acknowledgments').insert({
      company_id: ctx.companyId,
      policy_id: policyId,
      employee_id: ctx.employeeId,
    }),
  );
  if (!guardado.ok) {
    return { ok: false, error: 'No se pudo registrar tu acuse. Intenta de nuevo.' };
  }
  return { ok: true };
}
