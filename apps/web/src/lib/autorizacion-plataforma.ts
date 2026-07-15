import { redirect } from 'next/navigation';
import { EVENTOS_AUDITORIA, registrarAuditoriaEstricta } from './auditoria';
import { pasoMfaAdmin } from './mfa-admin';
import { evaluarGrantSoporte, type GrantSoporte } from './soporte-grant';
import { clienteAdmin } from './supabase-admin';
import { clienteSesion } from './supabase-servidor';

// Autorización del portal de plataforma (spec §1.3–§1.5). La identidad de plataforma se
// resuelve SIEMPRE por fila real en platform_users consultada por auth.uid() — nunca por
// claim JWT (se desincroniza) ni por app.es_plataforma() en BD (no existe a propósito:
// sería la puerta que las reglas inviolables 4 y 5 prohíben).
//
// CONVENCIÓN DE LLAMADA: toda página y toda acción de servidor bajo /admin llama
// autorizarPlataforma() como PRIMERA LÍNEA — el layout no protege server actions; el
// layout la llama además solo para UX (redirect temprano).

export interface OperadorPlataforma {
  authUserId: string; // auth.uid()
  operadorId: string; // platform_users.id
  email: string;
}

export async function autorizarPlataforma(): Promise<OperadorPlataforma> {
  const supabase = await clienteSesion();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/ingresar');

  // Fila propia leída CON LA SESIÓN del operador: la política RLS de fila propia es el
  // único lugar del portal donde RLS trabaja a favor. Cualquier paso falla → redirect;
  // nunca "seguir con menos".
  const { data: fila } = await supabase
    .from('platform_users')
    .select('id, email, status')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  // Sin fila o no-active: a la puerta del PANEL, sin revelar que /admin existe.
  if (!fila || fila.status !== 'active') redirect('/ingresar');

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal) redirect('/admin/ingresar');
  const paso = pasoMfaAdmin(aal, Date.now());
  if (paso === 'enrolar') redirect('/admin/mfa/enrolar');
  if (paso === 'verificar') redirect('/admin/mfa/verificar');

  return { authUserId: user.id, operadorId: fila.id, email: fila.email };
}

// ─── Vista de soporte (spec §6.4) ────────────────────────────────────────────

export interface AccesoSoporte extends OperadorPlataforma {
  grantId: string;
  companyId: string;
  expiresAt: string;
}

/**
 * Grant vigente y NOMINATIVO del operador para ese tenant, sin efecto de bitácora.
 * Lo usa el layout de la vista de soporte (solo UX); las páginas usan autorizarSoporte,
 * que además deja el evento — llamar esto NO abre ninguna página.
 */
export async function grantSoporteVigente(
  companyId: string,
  operadorId: string,
): Promise<GrantSoporte | null> {
  // service_role justificado: el operador no es miembro del tenant; ninguna política
  // RLS puede mostrarle el grant — la autorización real es esta comparación nominativa.
  const { data: grants } = await clienteAdmin()
    .from('support_access_grants')
    .select('id, operator_user_id, expires_at, revoked_at')
    .eq('company_id', companyId);
  return evaluarGrantSoporte((grants ?? []) as GrantSoporte[], operadorId, Date.now());
}

/**
 * Autorización de la vista de soporte, fail-closed POR PÁGINA (spec §6.4):
 * 1. autorizarPlataforma() (aal2 + frescura TOTP).
 * 2. Grant vigente cuyo operator_user_id es EXACTAMENTE el operador de la sesión
 *    (decisión 5a): un grant del operador A no abre nada al B (amenaza 15).
 * 3. Evento estricto en el audit_log DEL TENANT: sin evento no hay página (regla 5
 *    aplicada a nosotros mismos).
 */
export async function autorizarSoporte(companyId: string, ruta: string): Promise<AccesoSoporte> {
  const operador = await autorizarPlataforma();

  const grant = await grantSoporteVigente(companyId, operador.operadorId);
  if (!grant) redirect(`/admin/organizaciones/${companyId}`);

  const registrado = await registrarAuditoriaEstricta(
    companyId,
    operador.authUserId,
    EVENTOS_AUDITORIA.soporteVistaConsultada,
    'support_grant',
    grant.id,
    { ruta, operador_email: operador.email },
  );
  if (!registrado) redirect(`/admin/organizaciones/${companyId}`);

  return { ...operador, grantId: grant.id, companyId, expiresAt: grant.expires_at };
}
