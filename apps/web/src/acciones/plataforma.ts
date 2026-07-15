'use server';

import {
  EVENTOS_PLATAFORMA,
  registrarAuditoriaPlataformaEstricta,
} from '@/lib/auditoria-plataforma';
import { autorizarPlataforma } from '@/lib/autorizacion-plataforma';
import { puedeDeshabilitarOperador, transicionOperadorValida } from '@/lib/operadores';
import { clienteAdmin } from '@/lib/supabase-admin';
import { clienteSesion } from '@/lib/supabase-servidor';

// Acciones del portal de plataforma. TODAS empiezan con autorizarPlataforma() (el layout
// no protege server actions) y mutan con service_role — uso justificado: las tablas de
// plataforma no tienen GRANTs para authenticated (la frontera es "solo la app escribe").
// Patrón de bitácora: variante ESTRICTA ANTES de la mutación (sin evento no hay
// mutación, fail-closed como todo lo demás).

export interface ResultadoPlataforma {
  ok: boolean;
  error?: string;
}

interface FilaOperador {
  id: string;
  auth_user_id: string;
  email: string;
  status: 'invited' | 'active' | 'disabled';
}

export async function accionInvitarOperador(email: string): Promise<ResultadoPlataforma> {
  const operador = await autorizarPlataforma();
  const limpio = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio)) {
    return { ok: false, error: 'Escribe un correo válido.' };
  }
  const admin = clienteAdmin();

  const { data: existente } = await admin
    .from('platform_users')
    .select('id')
    .eq('email', limpio)
    .maybeSingle();
  if (existente) return { ok: false, error: 'Ya existe un operador con ese correo.' };

  const registrado = await registrarAuditoriaPlataformaEstricta(
    operador.operadorId,
    EVENTOS_PLATAFORMA.operadorInvitado,
    undefined,
    'platform_users',
    undefined,
    { email: limpio },
  );
  if (!registrado)
    return { ok: false, error: 'No se pudo registrar la bitácora. Intenta de nuevo.' };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { data: invitado, error: errorInvite } = await admin.auth.admin.inviteUserByEmail(limpio, {
    redirectTo: `${base}/admin/activar`,
  });
  if (errorInvite || !invitado.user) {
    return { ok: false, error: 'No se pudo enviar la invitación (¿el correo ya tiene cuenta?).' };
  }

  const { error: errorInsert } = await admin.from('platform_users').insert({
    auth_user_id: invitado.user.id,
    email: limpio,
    status: 'invited',
    invited_by: operador.operadorId,
  });
  if (errorInsert) {
    // El trigger de identidad dual (u otra violación) rechazó el alta: no dejar una
    // cuenta auth huérfana invitada a /admin.
    await admin.auth.admin.deleteUser(invitado.user.id);
    return {
      ok: false,
      error: 'No se pudo dar de alta al operador (¿la cuenta ya pertenece a una empresa?).',
    };
  }
  return { ok: true };
}

export async function accionDeshabilitarOperador(
  operadorObjetivoId: string,
): Promise<ResultadoPlataforma> {
  const operador = await autorizarPlataforma();
  const admin = clienteAdmin();

  const { data: filas } = await admin
    .from('platform_users')
    .select('id, auth_user_id, email, status');
  const operadores = (filas ?? []) as FilaOperador[];
  const validacion = puedeDeshabilitarOperador(operadores, operadorObjetivoId);
  if (!validacion.ok) return validacion;
  const objetivo = operadores.find((o) => o.id === operadorObjetivoId)!;

  const registrado = await registrarAuditoriaPlataformaEstricta(
    operador.operadorId,
    EVENTOS_PLATAFORMA.operadorDeshabilitado,
    undefined,
    'platform_users',
    objetivo.id,
    { email: objetivo.email, status_anterior: objetivo.status },
  );
  if (!registrado)
    return { ok: false, error: 'No se pudo registrar la bitácora. Intenta de nuevo.' };

  const { error } = await admin
    .from('platform_users')
    .update({ status: 'disabled', disabled_at: new Date().toISOString() })
    .eq('id', objetivo.id);
  if (error) return { ok: false, error: 'No se pudo deshabilitar al operador.' };

  // Cerrar la puerta de auth: el ban impide nuevos logins; las sesiones vigentes mueren
  // funcionalmente en el siguiente request porque autorizarPlataforma() re-lee la fila
  // real (status='disabled') — esa es la ventaja de no usar claims.
  await admin.auth.admin.updateUserById(objetivo.auth_user_id, { ban_duration: '876000h' });
  return { ok: true };
}

/**
 * Cierre del alta de un operador invitado (spec §1.2): se llama desde /admin/activar con
 * la SESIÓN del invitado, después de fijar contraseña y VERIFICAR su factor TOTP. Sin
 * factor verificado (aal2 actual) no hay transición a 'active'.
 */
export async function accionActivarOperador(): Promise<ResultadoPlataforma> {
  const supabase = await clienteSesion();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, error: 'Tu sesión expiró. Abre de nuevo el enlace de invitación.' };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') {
    return { ok: false, error: 'Activa y verifica tu app autenticadora antes de continuar.' };
  }

  const admin = clienteAdmin();
  const { data: fila } = await admin
    .from('platform_users')
    .select('id, email, status')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!fila) return { ok: false, error: 'Esta cuenta no tiene una invitación de operador.' };
  if (!transicionOperadorValida(fila.status as 'invited' | 'active' | 'disabled', 'active')) {
    return { ok: false, error: 'Esta invitación ya no está vigente.' };
  }

  const registrado = await registrarAuditoriaPlataformaEstricta(
    fila.id,
    EVENTOS_PLATAFORMA.operadorActivado,
    undefined,
    'platform_users',
    fila.id,
    { email: fila.email },
  );
  if (!registrado)
    return { ok: false, error: 'No se pudo registrar la bitácora. Intenta de nuevo.' };

  const { error } = await admin
    .from('platform_users')
    .update({ status: 'active', activated_at: new Date().toISOString() })
    .eq('id', fila.id)
    .eq('status', 'invited');
  if (error) return { ok: false, error: 'No se pudo activar tu cuenta de operador.' };
  return { ok: true };
}
