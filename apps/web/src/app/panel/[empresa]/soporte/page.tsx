import type { Metadata } from 'next';
import { accionOtorgarAccesoSoporte, accionRevocarAccesoSoporte } from '@/acciones/soporte-tenant';
import { OtorgarAcceso, RevocarAcceso } from '@/components/panel/soporte-grants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { fechaEsMx } from '@/lib/fechas';
import { clienteAdmin } from '@/lib/supabase-admin';
import { clienteSesion } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Acceso de soporte' };

function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso));
}

/**
 * Transparencia bilateral (spec §6.6) + destino del deep link de solicitud (§6.3): el
 * formulario llega pre-llenado desde el correo, pero la confirmación SIEMPRE ocurre
 * aquí, con la sesión del admin.
 */
export default async function PaginaSoporteTenant({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ operador?: string; horas?: string; motivo?: string }>;
}) {
  const { empresa } = await params;
  const acceso = await autorizarEmpresa(empresa);
  const consulta = await searchParams;

  // Grants con la SESIÓN (RLS: todo el tenant los ve — transparencia).
  const supabase = await clienteSesion();
  const { data: grants } = await supabase
    .from('support_access_grants')
    .select('id, operator_email, reason, created_at, expires_at, revoked_at')
    .eq('company_id', empresa)
    .order('created_at', { ascending: false });

  // Deep link: resuelve id → email del operador con service_role EN SERVIDOR (el tenant
  // no puede leer platform_users; el display jamás confía en el query string).
  let solicitud: { operadorId: string; email: string } | null = null;
  if (consulta.operador && acceso.membresia.rol === 'admin_org') {
    const { data: operador } = await clienteAdmin()
      .from('platform_users')
      .select('id, email, status')
      .eq('id', consulta.operador)
      .maybeSingle();
    if (operador && operador.status === 'active') {
      solicitud = { operadorId: operador.id, email: operador.email };
    }
  }

  const ahora = Date.now();
  const otorgar = accionOtorgarAccesoSoporte.bind(null, empresa);
  const revocar = accionRevocarAccesoSoporte.bind(null, empresa);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Accesos de soporte</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-texto-secundario">
            Aquí ves quién del equipo de Constata ha tenido acceso de solo lectura a tu
            organización, hasta cuándo, y puedes revocarlo en un clic. Cada página que consultan
            queda en tu bitácora.
          </p>
          {(grants ?? []).length === 0 && (
            <p className="text-texto-secundario">Nadie ha tenido acceso de soporte.</p>
          )}
          <ul className="flex flex-col gap-3">
            {(grants ?? []).map((g) => {
              const vigente = !g.revoked_at && new Date(g.expires_at).getTime() > ahora;
              return (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-borde p-3"
                >
                  <div>
                    <p className="font-medium">{g.operator_email}</p>
                    <p className="text-xs text-texto-secundario">
                      {g.reason} · otorgado el {fechaEsMx(g.created_at)} ·{' '}
                      {g.revoked_at
                        ? `revocado el ${fechaEsMx(g.revoked_at)}`
                        : vigente
                          ? `expira ${fechaHora(g.expires_at)}`
                          : `expiró ${fechaHora(g.expires_at)}`}
                    </p>
                  </div>
                  {vigente && acceso.membresia.rol === 'admin_org' && (
                    <RevocarAcceso
                      grantId={g.id}
                      operadorEmail={g.operator_email}
                      revocar={revocar}
                    />
                  )}
                  {vigente && (
                    <span
                      className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                      data-testid={`grant-vigente-${g.id}`}
                    >
                      Vigente
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Otorgar acceso</CardTitle>
        </CardHeader>
        <CardContent>
          {acceso.membresia.rol !== 'admin_org' ? (
            <p className="text-sm text-texto-secundario">
              Solo un Administrador de la organización puede otorgar acceso de soporte.
            </p>
          ) : solicitud ? (
            <OtorgarAcceso
              operadorId={solicitud.operadorId}
              operadorEmail={solicitud.email}
              horasIniciales={Math.min(72, Math.max(1, Number(consulta.horas) || 24))}
              motivoInicial={consulta.motivo ?? ''}
              otorgar={otorgar}
            />
          ) : (
            <p className="text-sm text-texto-secundario">
              El acceso se otorga desde el enlace que llega por correo cuando el equipo de Constata
              lo solicita: ahí verás a la persona exacta, el alcance y la duración antes de
              confirmar. Sin una solicitud, no hay nada que otorgar — y nadie de Constata puede
              entrar sin tu consentimiento.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
