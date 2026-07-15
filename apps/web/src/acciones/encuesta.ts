'use server';

import { preguntasPorId, respuestaValida, type DefinicionCuestionario } from '@/lib/cuestionarios';
import { ipCliente, permitido } from '@/lib/limites';
import { clienteAdmin } from '@/lib/supabase-admin';
import { hashDeToken } from '@/lib/tokens';

// Flujo del empleado para cuestionarios personalizados (Fase 3). Igual que el flujo
// oficial: el token es la capacidad, se re-valida en cada acción, todo corre con
// service_role (el empleado no tiene sesión) y las respuestas son append-only.

export interface ResultadoEncuesta {
  ok: boolean;
  error?: string;
}

export interface ContextoEncuesta {
  asignacionId: string;
  companyId: string;
  cuestionarioId: string;
  titulo: string;
  definicion: DefinicionCuestionario;
  expiraEl: string;
  completado: boolean;
  /** false si el tenant está suspendido o en baja (Fase 5): mismo check que el flujo oficial. */
  empresaActiva: boolean;
  empleadoNombre: string;
}

export async function contextoEncuesta(token: string): Promise<ContextoEncuesta | null> {
  const { data } = await clienteAdmin()
    .from('custom_assignments')
    .select(
      `id, company_id, questionnaire_id, expires_at, completed_at,
       employees (full_name),
       companies (status),
       custom_questionnaires (title, definition, status)`,
    )
    .eq('token_hash', hashDeToken(token))
    .maybeSingle();
  if (!data) return null;
  const cuestionario = data.custom_questionnaires as unknown as {
    title: string;
    definition: DefinicionCuestionario;
    status: string;
  };
  return {
    asignacionId: data.id,
    companyId: data.company_id,
    cuestionarioId: data.questionnaire_id,
    titulo: cuestionario.title,
    definicion: cuestionario.definition,
    expiraEl: data.expires_at,
    completado: data.completed_at !== null,
    empresaActiva: (data.companies as unknown as { status: string }).status === 'active',
    empleadoNombre: (data.employees as unknown as { full_name: string }).full_name,
  };
}

async function contextoActivo(token: string): Promise<ContextoEncuesta | { error: string }> {
  // Mismos límites que el flujo oficial: por token para uso legítimo, por IP para
  // adivinación de enlaces (Fase 2.5).
  const clave = `token-cp:${hashDeToken(token).slice(0, 16)}`;
  if (!(await permitido(clave, { ventanaSegundos: 3600, maximo: 1000 }))) {
    return { error: 'Demasiadas operaciones con este enlace. Espera unos minutos.' };
  }
  const ctx = await contextoEncuesta(token);
  if (!ctx) {
    const ip = await ipCliente();
    await permitido(`token-miss:${ip}`, { ventanaSegundos: 600, maximo: 30 });
    return { error: 'Enlace inválido' };
  }
  if (!ctx.empresaActiva) return { error: 'Cuestionario no disponible temporalmente' };
  if (ctx.completado) return { error: 'Este cuestionario ya fue enviado' };
  if (new Date(ctx.expiraEl).getTime() < Date.now()) return { error: 'Este enlace ha expirado' };
  return ctx;
}

export async function accionGuardarRespuestaEncuesta(
  token: string,
  preguntaId: string,
  valor: string,
): Promise<ResultadoEncuesta> {
  const ctx = await contextoActivo(token);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const pregunta = preguntasPorId(ctx.definicion).get(preguntaId);
  if (!pregunta) return { ok: false, error: 'Pregunta inválida' };
  if (!respuestaValida(pregunta, valor)) return { ok: false, error: 'Respuesta inválida' };

  const { error } = await clienteAdmin().from('custom_answers').insert({
    company_id: ctx.companyId,
    assignment_id: ctx.asignacionId,
    question_key: preguntaId,
    answer: valor,
  });
  if (error) return { ok: false, error: 'No se pudo guardar la respuesta' };
  return { ok: true };
}

export async function accionEnviarEncuesta(token: string): Promise<ResultadoEncuesta> {
  const ctx = await contextoActivo(token);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const { error } = await clienteAdmin()
    .from('custom_assignments')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', ctx.asignacionId)
    .is('completed_at', null);
  if (error) return { ok: false, error: 'No se pudo enviar. Intenta de nuevo.' };
  return { ok: true };
}

/** Respuestas vigentes (la última por pregunta) para rehidratar la UI en reconexión. */
export async function respuestasEncuesta(asignacionId: string): Promise<Record<string, string>> {
  const { data } = await clienteAdmin()
    .from('custom_answers')
    .select('question_key, answer, answered_at')
    .eq('assignment_id', asignacionId)
    .order('answered_at', { ascending: true });
  const vigentes: Record<string, string> = {};
  for (const fila of data ?? []) vigentes[fila.question_key] = fila.answer;
  return vigentes;
}
