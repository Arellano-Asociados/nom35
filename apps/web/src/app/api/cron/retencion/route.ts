import { NextResponse, type NextRequest } from 'next/server';
import {
  EVENTOS_PLATAFORMA,
  registrarAuditoriaPlataformaEstricta,
} from '@/lib/auditoria-plataforma';
import { plantillaCorreo, proveedorCorreo } from '@/lib/correo';
import { fechaEsMx } from '@/lib/fechas';
import { permitido } from '@/lib/limites';
import { RETENCION_DIAS } from '@/lib/organizaciones';
import { fechaLimiteRetencion, hitoPendiente } from '@/lib/retencion';
import { clienteAdmin } from '@/lib/supabase-admin';

// Job PROPIO de retención (spec §2.5, decisión sellada 6) — NO es una excepción del
// cron de recordatorios, por tres razones: (1) audiencias distintas (aquí se escribe a
// los ADMINS del tenant, sin tokens; aquel escribe a empleados con tokens rotados);
// (2) la invariante "el cron de recordatorios jamás toca tenants no activos" queda
// intacta; (3) bitácoras distintas: el aviso de retención es un acto de plataforma y va
// a platform_audit_log (actor sistema), no a la bitácora del tenant.
//
// FAIL-CLOSED INVERSO al resto: el evento se escribe con la variante ESTRICTA ANTES del
// envío — si la bitácora falla, el aviso no se envía (un aviso no probado no defiende
// la purga). Idempotente por bitácora: un hito registrado no se reenvía jamás.

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = clienteAdmin();
  const { data: empresas } = await supabase
    .from('companies')
    .select('id, legal_name, deletion_requested_at')
    .eq('status', 'pending_deletion')
    .not('deletion_requested_at', 'is', null);

  const ahora = Date.now();
  let avisos = 0;

  for (const empresa of empresas ?? []) {
    // Hitos ya enviados según la bitácora de plataforma (fuente de la idempotencia).
    const { data: enviados } = await supabase
      .from('platform_audit_log')
      .select('details')
      .eq('event_type', EVENTOS_PLATAFORMA.avisoRetencionEnviado)
      .eq('company_id', empresa.id);
    const hitosEnviados = (enviados ?? [])
      .map((e) => Number((e.details as { hito?: number }).hito))
      .filter((h) => Number.isFinite(h));

    const hito = hitoPendiente(empresa.deletion_requested_at, ahora, hitosEnviados);
    if (hito === null) continue;

    // Limitador (doble corrida del cron = un solo intento por empresa).
    if (!(await permitido(`retencion:${empresa.id}`, { ventanaSegundos: 600, maximo: 1 }))) {
      continue;
    }

    const { data: admins } = await supabase
      .from('role_assignments')
      .select('auth_user_id')
      .eq('company_id', empresa.id)
      .eq('role', 'admin_org');
    const correos: string[] = [];
    for (const fila of admins ?? []) {
      const { data } = await supabase.auth.admin.getUserById(fila.auth_user_id);
      if (data.user?.email) correos.push(data.user.email);
    }
    if (correos.length === 0) continue;

    const fechaLimite = fechaLimiteRetencion(empresa.deletion_requested_at, RETENCION_DIAS);

    // Evento ESTRICTO ANTES del envío: sin constancia no hay aviso.
    const registrado = await registrarAuditoriaPlataformaEstricta(
      null, // actor sistema
      EVENTOS_PLATAFORMA.avisoRetencionEnviado,
      empresa.id,
      'companies',
      empresa.id,
      { hito, fecha_limite: fechaLimite.toISOString(), destinatarios: correos.length },
    );
    if (!registrado) continue;

    try {
      await proveedorCorreo().enviar({
        para: correos,
        asunto: `Tu cuenta cierra pronto: descarga tu expediente antes del ${fechaEsMx(fechaLimite.toISOString())}`,
        html: plantillaCorreo({
          saludo: 'Aviso importante sobre la baja de tu cuenta:',
          parrafos: [
            `La baja de ${empresa.legal_name} está en curso (día ${hito} del periodo de retención). Tu panel sigue disponible en modo lectura.`,
            `Descarga tu expediente final (informes, expedientes de inspección y evidencia histórica) antes del ${fechaEsMx(fechaLimite.toISOString())}: después de esa fecha los datos se eliminarán de forma definitiva e irreversible.`,
            'Si la baja es un error, contáctanos: dentro del plazo aún es reversible.',
          ],
          cta: process.env.NEXT_PUBLIC_APP_URL
            ? { url: `${process.env.NEXT_PUBLIC_APP_URL}/panel`, etiqueta: 'Ir a mi panel' }
            : undefined,
        }),
      });
      avisos++;
    } catch {
      // El evento ya registró el intento con sus destinatarios; el reenvío ocurrirá si
      // el hito siguiente lo alcanza — un fallo de SMTP no debe tirar el job entero.
    }
  }

  return NextResponse.json({ ok: true, empresas: (empresas ?? []).length, avisos });
}
