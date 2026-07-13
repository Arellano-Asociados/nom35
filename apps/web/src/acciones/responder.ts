'use server';

import { GR2, GR3 } from '@nom35/motor-nom035';
import { headers } from 'next/headers';
import { enviarCuestionario, obtenerContexto, type Contexto } from '@/lib/flujo';
import { avisoVigenteDe } from '@/lib/aviso-privacidad';
import { escrituraOk } from '@/lib/escrituras';
import { clienteAdmin } from '@/lib/supabase-admin';

// Acciones del flujo del empleado. El token del enlace es la capacidad: se re-valida en
// CADA acción (existencia, vigencia, estado). Nunca se confía en datos del cliente.

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

const OPCIONES_LIKERT = ['siempre', 'casi_siempre', 'algunas_veces', 'casi_nunca', 'nunca'];

async function contextoActivo(token: string): Promise<Contexto | { error: string }> {
  const ctx = await obtenerContexto(token);
  if (!ctx) return { error: 'Enlace inválido' };
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
      return { ok: false, error: 'Este ítem no aplica según tus preguntas filtro' };
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
