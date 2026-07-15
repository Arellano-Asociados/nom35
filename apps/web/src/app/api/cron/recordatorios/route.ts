import { NextResponse, type NextRequest } from 'next/server';
import { permitido } from '@/lib/limites';
import {
  ACTOR_SISTEMA,
  debeRecordar,
  enviarRecordatoriosDeCiclo,
  ultimoRecordatorioDe,
} from '@/lib/recordatorios';
import { clienteAdmin } from '@/lib/supabase-admin';

// Cron de recordatorios automáticos (Fase 3): recorre los ciclos con
// reminder_interval_days configurado y reenvía a pendientes cuando pasaron ≥N días
// desde el último envío (manual o automático, según la bitácora). Idempotente:
// respeta el limitador por ciclo de la mini-fase 3, así que una doble ejecución
// del cron no duplica correos. En Vercel se dispara con vercel.json (crons) y la
// plataforma manda `Authorization: Bearer CRON_SECRET`.

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = clienteAdmin();
  const { data: ciclos } = await supabase
    .from('compliance_cycles')
    .select('id, company_id, reminder_interval_days, companies (legal_name, status)')
    .not('reminder_interval_days', 'is', null);

  const ahora = new Date().toISOString();
  let procesados = 0;
  let totalEnviados = 0;

  for (const ciclo of ciclos ?? []) {
    // Fase 5: un tenant no activo no genera NI UN correo (spec §2.2.3). Los avisos de
    // retención de la baja NO pasan por este cron: tienen su job propio (§2.5).
    const empresa = ciclo.companies as unknown as { legal_name: string; status: string };
    if (empresa.status !== 'active') continue;

    const ultimo = await ultimoRecordatorioDe(ciclo.id);
    if (
      !debeRecordar({ intervaloDias: ciclo.reminder_interval_days, ultimoEnvio: ultimo, ahora })
    ) {
      continue;
    }
    // ¿Quedan pendientes? Sin pendientes no hay nada que recordar (ni evento).
    const { count: pendientes } = await supabase
      .from('questionnaire_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', ciclo.id)
      .is('completed_at', null);
    if (!pendientes) continue;

    // Mismo limitador que el botón manual: doble corrida del cron = un solo envío.
    if (!(await permitido(`recordatorios:${ciclo.id}`, { ventanaSegundos: 600, maximo: 1 }))) {
      continue;
    }

    totalEnviados += await enviarRecordatoriosDeCiclo({
      companyId: ciclo.company_id,
      cicloId: ciclo.id,
      razonSocial: empresa.legal_name,
      actorUserId: ACTOR_SISTEMA,
    });
    procesados++;
  }

  return NextResponse.json({ ok: true, ciclos: procesados, enviados: totalEnviados });
}
