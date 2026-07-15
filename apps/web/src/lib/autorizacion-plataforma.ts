import { redirect } from 'next/navigation';
import { pasoMfaAdmin } from './mfa-admin';
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
