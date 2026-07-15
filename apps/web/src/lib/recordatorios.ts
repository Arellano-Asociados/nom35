import { registrarAuditoria } from './auditoria';
import { plantillaCorreo, proveedorCorreo } from './correo';
import { fechaEsMx } from './fechas';
import { plantillaVigente, renderPlantilla } from './plantillas';
import { clienteAdmin } from './supabase-admin';
import { generarToken, hashDeToken } from './tokens';

/** Actor de eventos generados por el sistema (cron) en audit_log. */
export const ACTOR_SISTEMA = '00000000-0000-0000-0000-000000000000';

/**
 * Decisión PURA de los recordatorios automáticos (Fase 3): con intervalo
 * configurado, recuerda cuando pasaron ≥ N días desde el último envío (manual o
 * automático); sin envíos previos, arranca de inmediato.
 */
export function debeRecordar({
  intervaloDias,
  ultimoEnvio,
  ahora,
}: {
  intervaloDias: number | null;
  ultimoEnvio: string | null;
  ahora: string;
}): boolean {
  if (!intervaloDias) return false;
  if (!ultimoEnvio) return true;
  const transcurridoMs = new Date(ahora).getTime() - new Date(ultimoEnvio).getTime();
  return transcurridoMs >= intervaloDias * 24 * 60 * 60 * 1000;
}

/**
 * Envío de recordatorios a pendientes de un ciclo: rota el token de cada asignación
 * pendiente y reenvía el enlace con la plantilla vigente. Compartido por la acción
 * del panel (actor = usuario) y el cron (actor = sistema). service_role legítimo:
 * escribe token_hash y envía correos.
 */
export async function enviarRecordatoriosDeCiclo({
  companyId,
  cicloId,
  razonSocial,
  actorUserId,
}: {
  companyId: string;
  cicloId: string;
  razonSocial: string;
  actorUserId: string;
}): Promise<number> {
  const supabase = clienteAdmin();

  // Fase 5: el cron de recordatorios JAMÁS toca tenants no activos (invariante del spec
  // §2.2.3) — y la acción manual del panel tampoco: rotar tokens y enviar correos
  // induciría respuestas que el flujo del empleado rechazaría.
  const { data: empresa } = await supabase
    .from('companies')
    .select('status')
    .eq('id', companyId)
    .maybeSingle();
  if (empresa?.status !== 'active') return 0;

  const { data: pendientes } = await supabase
    .from('questionnaire_assignments')
    .select('id, employee_id, employees (email, full_name)')
    .eq('company_id', companyId)
    .eq('cycle_id', cicloId)
    .is('completed_at', null);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const correo = proveedorCorreo();
  const plantilla = await plantillaVigente(supabase, companyId, 'recordatorio');
  let enviados = 0;

  for (const asignacion of pendientes ?? []) {
    const token = generarToken();
    const vencimiento = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const { error } = await supabase
      .from('questionnaire_assignments')
      .update({ token_hash: hashDeToken(token), expires_at: vencimiento.toISOString() })
      .eq('id', asignacion.id);
    if (error) continue;
    const empleado = asignacion.employees as unknown as { email: string; full_name: string };
    try {
      const r = renderPlantilla(plantilla, {
        nombre: empleado.full_name,
        empresa: razonSocial,
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
      enviados++;
    } catch {
      // sin interrumpir el resto
    }
  }

  await registrarAuditoria(
    companyId,
    actorUserId,
    'recordatorios_enviados',
    'compliance_cycles',
    cicloId,
    { enviados },
  );
  return enviados;
}

/** Último envío de recordatorios del ciclo según la bitácora (manual o cron). */
export async function ultimoRecordatorioDe(cicloId: string): Promise<string | null> {
  const { data } = await clienteAdmin()
    .from('audit_log')
    .select('created_at')
    .eq('event_type', 'recordatorios_enviados')
    .eq('entity_id', cicloId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.created_at ?? null;
}
