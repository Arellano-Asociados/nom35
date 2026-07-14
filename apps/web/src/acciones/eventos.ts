'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { registrarAuditoria } from '@/lib/auditoria';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { plantillaCorreo, proveedorCorreo } from '@/lib/correo';
import { fechaEsMx } from '@/lib/fechas';
import { plantillaVigente, renderPlantilla } from '@/lib/plantillas';
import { clienteAdmin } from '@/lib/supabase-admin';
import { clienteSesion } from '@/lib/supabase-servidor';
import { generarToken, hashDeToken } from '@/lib/tokens';
import type { ResultadoPanel } from './panel';

// Acontecimientos traumáticos severos (5.3 / 5.5 / 6.5). El evento se registra en
// cualquier momento (no depende del ciclo bienal) y su aplicación de GR-I se apoya
// íntegramente en el mecanismo existente: internamente crea un compliance_cycles
// marcado con traumatic_event_id, así que tokens, flujo del empleado, gr1_results,
// notificación al RD y canalizaciones funcionan sin cambios.

/** Registra el evento. La descripción documenta el HECHO, jamás datos de salud. */
export async function accionRegistrarEvento(companyId: string, formData: FormData): Promise<void> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) redirect(`/panel/${companyId}`);
  const ruta = `/panel/${companyId}/eventos`;

  const centroId = String(formData.get('centro') ?? '');
  const fecha = String(formData.get('fecha') ?? '');
  const descripcion = String(formData.get('descripcion') ?? '').trim();
  if (!centroId || !fecha || descripcion === '') redirect(`${ruta}?error=datos`);

  const { data: evento, error } = await (
    await clienteSesion()
  )
    .from('traumatic_events')
    .insert({
      company_id: companyId,
      work_center_id: centroId,
      occurred_on: fecha,
      description: descripcion,
      reported_by: acceso.userId,
    })
    .select('id')
    .single();
  if (error || !evento) redirect(`${ruta}?error=crear`);

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'evento_ats_registrado',
    'traumatic_events',
    evento.id,
  );
  redirect(`${ruta}/${evento.id}`);
}

/**
 * Aplica la GR-I a los trabajadores expuestos al evento: crea (si no existe) el ciclo
 * ATS del evento, asigna SOLO la GR-I a los seleccionados y les envía el enlace.
 * Idempotente por el unique (cycle_id, employee_id, questionnaire_id): repetir la
 * distribución no duplica asignaciones ni reenvía a quien ya la tiene.
 */
export async function accionDistribuirEvento(
  companyId: string,
  eventoId: string,
  empleadoIds: string[],
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia))
    return {
      ok: false,
      error:
        'Tu rol no permite esta acción. Pídele al Administrador de la organización que la realice o que te asigne el permiso.',
    };
  if (empleadoIds.length === 0)
    return { ok: false, error: 'Selecciona al menos un trabajador expuesto al acontecimiento.' };

  // service_role legítimo (Fase 2.5), mismo caso que accionDistribuir: esta acción genera
  // y escribe token_hash (la capacidad del empleado) y envía correos.
  const supabase = clienteAdmin();
  const { data: evento } = await supabase
    .from('traumatic_events')
    .select('id, occurred_on, work_center_id')
    .eq('company_id', companyId)
    .eq('id', eventoId)
    .maybeSingle();
  if (!evento) return { ok: false, error: 'Evento no encontrado' };

  // Los seleccionados DEBEN pertenecer al centro del evento: el id viene del navegador.
  const { data: empleados } = await supabase
    .from('employees')
    .select('id, email, full_name')
    .eq('company_id', companyId)
    .eq('work_center_id', evento.work_center_id)
    .eq('active', true)
    .in('id', empleadoIds);
  if (!empleados || empleados.length !== empleadoIds.length)
    return {
      ok: false,
      error: 'Algún trabajador seleccionado no pertenece al centro de este acontecimiento.',
    };

  const { data: guia } = await supabase
    .from('questionnaires')
    .select('id')
    .eq('code', 'GR-I')
    .single();
  if (!guia) return { ok: false, error: 'No se encontró la Guía de Referencia I' };

  // El ciclo ATS es interno: agrupa esta aplicación reactiva y la separa de la
  // evaluación ordinaria (no cuenta para la alerta bienal ni aparece en Ciclos).
  const { data: cicloExistente } = await supabase
    .from('compliance_cycles')
    .select('id')
    .eq('company_id', companyId)
    .eq('traumatic_event_id', eventoId)
    .maybeSingle();

  let cicloId = cicloExistente?.id;
  if (!cicloId) {
    const { data: creado, error: errorCiclo } = await supabase
      .from('compliance_cycles')
      .insert({
        company_id: companyId,
        work_center_id: evento.work_center_id,
        traumatic_event_id: eventoId,
        name: `Evento ATS — ${fechaEsMx(evento.occurred_on)}`,
        date_start: evento.occurred_on,
        evaluator_name: acceso.membresia.razonSocial,
        evaluator_license: 'N/A',
      })
      .select('id')
      .single();
    if (errorCiclo || !creado)
      return { ok: false, error: 'No se pudo preparar la aplicación de la Guía I' };
    cicloId = creado.id;
  }

  const { data: existentes } = await supabase
    .from('questionnaire_assignments')
    .select('employee_id')
    .eq('cycle_id', cicloId)
    .eq('questionnaire_id', guia.id);
  const yaAsignados = new Set((existentes ?? []).map((a) => a.employee_id));

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const correo = proveedorCorreo();
  const plantilla = await plantillaVigente(supabase, companyId, 'invitacion');
  let creadas = 0;
  let correosEnviados = 0;

  for (const empleado of empleados) {
    if (yaAsignados.has(empleado.id)) continue;
    const token = generarToken();
    const vencimiento = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const { error } = await supabase.from('questionnaire_assignments').insert({
      company_id: companyId,
      cycle_id: cicloId,
      employee_id: empleado.id,
      questionnaire_id: guia.id,
      token_hash: hashDeToken(token),
      expires_at: vencimiento.toISOString(),
    });
    if (error) continue;
    creadas++;
    try {
      // Misma plantilla de invitación vigente: el correo JAMÁS menciona el
      // acontecimiento ni motivo alguno (sería un dato sensible en el buzón del
      // trabajador y de quien tenga acceso a su correo).
      const r = renderPlantilla(plantilla, {
        nombre: empleado.full_name,
        empresa: acceso.membresia.razonSocial,
        fecha_limite: fechaEsMx(vencimiento.toISOString()),
      });
      const [saludo, ...parrafos] = r.parrafos;
      await correo.enviar({
        para: [empleado.email],
        asunto: r.asunto,
        html: plantillaCorreo({
          saludo: saludo ?? `Hola ${empleado.full_name}:`,
          parrafos,
          cta: { url: `${base}/responder/${token}`, etiqueta: 'Responder cuestionario' },
        }),
      });
      correosEnviados++;
    } catch {
      // El envío no debe tirar la distribución; el enlace puede rotarse después.
    }
  }

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'evento_ats_distribuido',
    'traumatic_events',
    eventoId,
    { asignaciones_creadas: creadas, correos_enviados: correosEnviados, ciclo_id: cicloId },
  );
  revalidatePath(`/panel/${companyId}/eventos/${eventoId}`);
  return {
    ok: true,
    detalle: [`${creadas} cuestionarios asignados`, `${correosEnviados} correos enviados`],
  };
}
