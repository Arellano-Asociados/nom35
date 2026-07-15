'use server';

import { EVENTOS_AUDITORIA, registrarAuditoria } from '@/lib/auditoria';
import {
  EVENTOS_PLATAFORMA,
  registrarAuditoriaPlataformaEstricta,
  type EventoPlataforma,
} from '@/lib/auditoria-plataforma';
import { autorizarPlataforma } from '@/lib/autorizacion-plataforma';
import { plantillaCorreo, proveedorCorreo } from '@/lib/correo';
import { FLAGS } from '@/lib/flags';
import { puedeDeshabilitarOperador, transicionOperadorValida } from '@/lib/operadores';
import { transicionEmpresaValida, type EstadoEmpresa } from '@/lib/organizaciones';
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

// ─── Organizaciones (spec §2.1–§2.3) ─────────────────────────────────────────

/**
 * Alta operada por plataforma: crea la empresa e invita a su primer admin por correo
 * (el registro autoservicio se conserva aparte — decisión sellada 1). El invitado fija
 * su contraseña en /cuenta y aterriza en /panel ya con membresía.
 */
export async function accionCrearEmpresaPlataforma(
  razonSocial: string,
  rfc: string,
  emailAdmin: string,
): Promise<ResultadoPlataforma> {
  const operador = await autorizarPlataforma();
  const razon = razonSocial.trim();
  const correo = emailAdmin.trim().toLowerCase();
  if (razon === '') return { ok: false, error: 'Escribe la razón social.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    return { ok: false, error: 'Escribe un correo válido para el administrador.' };
  }

  const admin = clienteAdmin();
  // Mismo bootstrap service_role que el registro autoservicio (el invitado aún no tiene
  // membresía; ninguna política RLS puede autorizar esto).
  const { data: empresa, error: errorEmpresa } = await admin
    .from('companies')
    .insert({ legal_name: razon, rfc: rfc.trim() || null, privacy_notice_version: 'v1' })
    .select('id')
    .single();
  if (errorEmpresa || !empresa) return { ok: false, error: 'No se pudo crear la empresa.' };

  const registrado = await registrarAuditoriaPlataformaEstricta(
    operador.operadorId,
    EVENTOS_PLATAFORMA.empresaCreadaPorPlataforma,
    empresa.id,
    'companies',
    empresa.id,
    { razon_social: razon, email_admin: correo },
  );
  if (!registrado) {
    // Sin evento no hay mutación: la empresa recién creada (sin miembros ni datos) se
    // revierte para no dejar un tenant fantasma fuera de bitácora.
    await admin.from('companies').delete().eq('id', empresa.id);
    return { ok: false, error: 'No se pudo registrar la bitácora. Intenta de nuevo.' };
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { data: invitado, error: errorInvite } = await admin.auth.admin.inviteUserByEmail(correo, {
    redirectTo: `${base}/cuenta`,
  });
  if (errorInvite || !invitado.user) {
    return {
      ok: false,
      error:
        'La empresa quedó creada pero no se pudo invitar al administrador (¿el correo ya tiene cuenta?). Reintenta desde la ficha.',
    };
  }

  const { error: errorRol } = await admin.from('role_assignments').insert({
    company_id: empresa.id,
    auth_user_id: invitado.user.id,
    role: 'admin_org',
  });
  if (errorRol) {
    return {
      ok: false,
      error: 'La invitación salió pero no se pudo asignar el rol de administrador. Reintenta.',
    };
  }

  await registrarAuditoria(
    empresa.id,
    operador.authUserId,
    EVENTOS_AUDITORIA.empresaCreada,
    'companies',
    empresa.id,
    { alta_operada_por_plataforma: true },
  );
  return { ok: true };
}

const EVENTO_PLATAFORMA_POR_DESTINO: Record<EstadoEmpresa, EventoPlataforma> = {
  suspended: EVENTOS_PLATAFORMA.empresaSuspendida,
  active: EVENTOS_PLATAFORMA.empresaReactivada,
  pending_deletion: EVENTOS_PLATAFORMA.empresaBajaSolicitada,
};

const EVENTO_TENANT_POR_DESTINO = {
  suspended: EVENTOS_AUDITORIA.empresaSuspendida,
  active: EVENTOS_AUDITORIA.empresaReactivada,
  pending_deletion: EVENTOS_AUDITORIA.empresaBajaSolicitada,
} as const;

/**
 * Transición de estado con doble bitácora (spec §2.1): plataforma ESTRICTA (sin evento
 * no hay mutación) + tenant fire-and-forget (el cliente tiene derecho a ver en su
 * bitácora que fue suspendido/reactivado/dado de baja; actor = operador).
 */
async function transicionarEmpresa(
  companyId: string,
  destino: EstadoEmpresa,
  detalles: Record<string, unknown>,
): Promise<ResultadoPlataforma> {
  const operador = await autorizarPlataforma();
  const admin = clienteAdmin();

  const { data: empresa } = await admin
    .from('companies')
    .select('id, legal_name, status')
    .eq('id', companyId)
    .maybeSingle();
  if (!empresa) return { ok: false, error: 'La organización no existe.' };
  if (!transicionEmpresaValida(empresa.status as EstadoEmpresa, destino)) {
    return {
      ok: false,
      error: `La transición ${empresa.status} → ${destino} no está permitida.`,
    };
  }

  const registrado = await registrarAuditoriaPlataformaEstricta(
    operador.operadorId,
    EVENTO_PLATAFORMA_POR_DESTINO[destino],
    companyId,
    'companies',
    companyId,
    { ...detalles, status_anterior: empresa.status },
  );
  if (!registrado)
    return { ok: false, error: 'No se pudo registrar la bitácora. Intenta de nuevo.' };

  const ahora = new Date().toISOString();
  const { error } = await admin
    .from('companies')
    .update({
      status: destino,
      status_changed_at: ahora,
      suspension_reason: destino === 'suspended' ? ((detalles.motivo as string) ?? null) : null,
      deletion_requested_at: destino === 'pending_deletion' ? ahora : null,
    })
    .eq('id', companyId)
    .eq('status', empresa.status);
  if (error) return { ok: false, error: 'No se pudo aplicar la transición.' };

  await registrarAuditoria(
    companyId,
    operador.authUserId,
    EVENTO_TENANT_POR_DESTINO[destino],
    'companies',
    companyId,
    detalles,
  );
  return { ok: true };
}

export async function accionSuspenderEmpresa(
  companyId: string,
  motivo: string,
): Promise<ResultadoPlataforma> {
  if (motivo.trim() === '') return { ok: false, error: 'Escribe el motivo de la suspensión.' };
  return transicionarEmpresa(companyId, 'suspended', { motivo: motivo.trim() });
}

export async function accionReactivarEmpresa(companyId: string): Promise<ResultadoPlataforma> {
  return transicionarEmpresa(companyId, 'active', {});
}

/** Inicia la baja: 90 días de retención en solo lectura; la purga es un script manual. */
export async function accionSolicitarBaja(
  companyId: string,
  motivo: string,
): Promise<ResultadoPlataforma> {
  return transicionarEmpresa(companyId, 'pending_deletion', {
    motivo: motivo.trim() || 'baja solicitada',
  });
}

/**
 * Arrepentimiento dentro del plazo: pending_deletion → suspended. Detiene el reloj de
 * purga; reactivar del todo es un acto separado (dos actos, dos eventos en bitácora).
 * El evento de plataforma/tenant que le corresponde es el de suspensión.
 */
export async function accionRevertirBaja(companyId: string): Promise<ResultadoPlataforma> {
  return transicionarEmpresa(companyId, 'suspended', {
    motivo: 'baja revertida (retención detenida)',
  });
}

// ─── Feature flags (spec §3) ─────────────────────────────────────────────────

/**
 * Cambia un feature flag del tenant desde la UI (reemplaza el SQL manual). Doble
 * bitácora: plataforma ESTRICTA con valor anterior→nuevo (sin evento no hay mutación) +
 * tenant fire-and-forget (el cliente ve que la plataforma le cambió un flag).
 */
export async function accionActualizarFlag(
  companyId: string,
  flag: string,
  enabled: boolean,
): Promise<ResultadoPlataforma> {
  const operador = await autorizarPlataforma();
  if (!Object.values(FLAGS).includes(flag as (typeof FLAGS)[keyof typeof FLAGS])) {
    return { ok: false, error: 'Flag desconocido.' };
  }

  const admin = clienteAdmin();
  const { data: empresa } = await admin
    .from('companies')
    .select('id')
    .eq('id', companyId)
    .maybeSingle();
  if (!empresa) return { ok: false, error: 'La organización no existe.' };

  const { data: actual } = await admin
    .from('feature_flags')
    .select('enabled')
    .eq('company_id', companyId)
    .eq('flag', flag)
    .maybeSingle();
  const anterior: boolean | null = actual?.enabled ?? null; // null = default del código

  const registrado = await registrarAuditoriaPlataformaEstricta(
    operador.operadorId,
    EVENTOS_PLATAFORMA.flagActualizado,
    companyId,
    'feature_flags',
    undefined,
    { flag, anterior, nuevo: enabled },
  );
  if (!registrado)
    return { ok: false, error: 'No se pudo registrar la bitácora. Intenta de nuevo.' };

  // service_role justificado: feature_flags es "solo plataforma escribe" (sin GRANT de
  // escritura para authenticated desde la Fase 3).
  const { error } = await admin
    .from('feature_flags')
    .upsert({ company_id: companyId, flag, enabled }, { onConflict: 'company_id,flag' });
  if (error) return { ok: false, error: 'No se pudo actualizar el flag.' };

  await registrarAuditoria(
    companyId,
    operador.authUserId,
    EVENTOS_AUDITORIA.flagActualizado,
    'feature_flags',
    undefined,
    { flag, anterior, nuevo: enabled },
  );
  return { ok: true };
}

// ─── Soporte: solicitud con deep link (spec §6.3, decisión 5b) ───────────────

/**
 * El operador SOLICITA acceso; jamás se lo otorga. El correo a los admins del cliente
 * lleva un deep link a su panel con el formulario pre-llenado (operador, alcance y
 * duración visibles ANTES de confirmar); la confirmación ocurre SIEMPRE en el panel del
 * cliente con su sesión, nunca desde el correo. SIN break-glass (decisión 5c).
 */
export async function accionSolicitarAcceso(
  companyId: string,
  motivo: string,
  horas: number,
): Promise<ResultadoPlataforma> {
  const operador = await autorizarPlataforma();
  const horasValidas = Math.min(72, Math.max(1, Math.trunc(horas) || 24));
  if (motivo.trim() === '') return { ok: false, error: 'Escribe el motivo de la solicitud.' };

  const admin = clienteAdmin();
  const { data: empresa } = await admin
    .from('companies')
    .select('id, legal_name, status')
    .eq('id', companyId)
    .maybeSingle();
  if (!empresa) return { ok: false, error: 'La organización no existe.' };
  if (empresa.status !== 'active') {
    return {
      ok: false,
      error:
        'La organización no está activa: un tenant no activo no puede otorgar grants. Usa las superficies del portal (ficha) para lo que necesites.',
    };
  }

  const registrado = await registrarAuditoriaPlataformaEstricta(
    operador.operadorId,
    EVENTOS_PLATAFORMA.soporteAccesoSolicitado,
    companyId,
    'support_access_grants',
    undefined,
    { motivo: motivo.trim(), horas: horasValidas, operador_email: operador.email },
  );
  if (!registrado)
    return { ok: false, error: 'No se pudo registrar la bitácora. Intenta de nuevo.' };

  const { data: admins } = await admin
    .from('role_assignments')
    .select('auth_user_id')
    .eq('company_id', companyId)
    .eq('role', 'admin_org');
  const correos: string[] = [];
  for (const fila of admins ?? []) {
    const { data } = await admin.auth.admin.getUserById(fila.auth_user_id);
    if (data.user?.email) correos.push(data.user.email);
  }
  if (correos.length === 0) {
    return {
      ok: false,
      error:
        'La organización no tiene administradores con correo: no hay a quién pedirle el consentimiento (y no existe camino de excepción).',
    };
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${base}/panel/${companyId}/soporte?operador=${operador.operadorId}&horas=${horasValidas}&motivo=${encodeURIComponent(motivo.trim())}`;
  await proveedorCorreo().enviar({
    para: correos,
    asunto: 'Constata solicita tu autorización para un acceso de soporte',
    html: plantillaCorreo({
      saludo: 'Hola:',
      parrafos: [
        `${operador.email}, del equipo de operación de Constata, solicita acceso de SOLO LECTURA a la información de ${empresa.legal_name} por ${horasValidas} horas. Motivo: ${motivo.trim()}.`,
        'El acceso solo existe si tú lo otorgas desde tu panel, es exclusivo para esa persona, expira automáticamente y puedes revocarlo en cualquier momento. Cada página que consulte queda registrada en tu bitácora.',
        'Este correo no otorga nada: la decisión se toma dentro de tu panel, con tu sesión.',
      ],
      cta: { url, etiqueta: 'Revisar la solicitud en mi panel' },
    }),
  });
  return { ok: true };
}

// ─── Operadores: activación ──────────────────────────────────────────────────

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
