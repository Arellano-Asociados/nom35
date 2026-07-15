'use server';

import { EVENTOS_AUDITORIA, registrarAuditoria } from '@/lib/auditoria';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';
import { clienteSesion } from '@/lib/supabase-servidor';

// Lado CLIENTE de los grants de soporte (spec §6.3/§6.6): el consentimiento se otorga y
// se revoca con la SESIÓN del admin del tenant, vía RLS — acto criptográficamente suyo.
// La plataforma jamás se auto-escribe un grant.

export interface ResultadoSoporte {
  ok: boolean;
  error?: string;
}

/** Tope duro del CHECK en BD; default de la UI: 24. */
const MAX_HORAS = 72;

export async function accionOtorgarAccesoSoporte(
  companyId: string,
  operadorId: string,
  horas: number,
  motivo: string,
): Promise<ResultadoSoporte> {
  const acceso = await autorizarEmpresa(companyId);
  if (acceso.membresia.rol !== 'admin_org') {
    return { ok: false, error: 'Solo un Administrador de la organización puede otorgar acceso.' };
  }
  if (!Number.isFinite(horas) || horas < 1 || horas > MAX_HORAS) {
    return { ok: false, error: `La duración debe ser de 1 a ${MAX_HORAS} horas.` };
  }
  if (motivo.trim() === '') {
    return { ok: false, error: 'Escribe el motivo del acceso.' };
  }

  // Resolución id → email del operador con service_role (lectura puntual justificada:
  // el tenant no puede leer platform_users y el display/email almacenado JAMÁS sale del
  // query string). Solo operadores ACTIVOS son autorizables.
  const { data: operador } = await clienteAdmin()
    .from('platform_users')
    .select('id, email, status')
    .eq('id', operadorId)
    .maybeSingle();
  if (!operador || operador.status !== 'active') {
    return { ok: false, error: 'El operador indicado no existe o no está activo.' };
  }

  // INSERT con la sesión del admin: RLS verifica es_admin_org + granted_by = auth.uid()
  // + tenant activo. El servidor no puede falsificar este consentimiento.
  const supabase = await clienteSesion();
  const { data: grant, error } = await supabase
    .from('support_access_grants')
    .insert({
      company_id: companyId,
      operator_user_id: operador.id,
      operator_email: operador.email,
      granted_by_user_id: acceso.userId,
      reason: motivo.trim(),
      expires_at: new Date(Date.now() + horas * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();
  if (error || !grant) {
    return { ok: false, error: 'No se pudo otorgar el acceso. Intenta de nuevo.' };
  }

  await registrarAuditoria(
    companyId,
    acceso.userId,
    EVENTOS_AUDITORIA.soporteAccesoOtorgado,
    'support_access_grants',
    grant.id,
    { operador_email: operador.email, horas, motivo: motivo.trim() },
  );
  return { ok: true };
}

export async function accionRevocarAccesoSoporte(
  companyId: string,
  grantId: string,
): Promise<ResultadoSoporte> {
  const acceso = await autorizarEmpresa(companyId);
  if (acceso.membresia.rol !== 'admin_org') {
    return { ok: false, error: 'Solo un Administrador de la organización puede revocar.' };
  }

  const supabase = await clienteSesion();
  const { data, error } = await supabase
    .from('support_access_grants')
    .update({ revoked_at: new Date().toISOString(), revoked_by_user_id: acceso.userId })
    .eq('id', grantId)
    .eq('company_id', companyId)
    .select('id, operator_email')
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: 'No se pudo revocar (¿ya estaba revocado?).' };
  }

  await registrarAuditoria(
    companyId,
    acceso.userId,
    EVENTOS_AUDITORIA.soporteAccesoRevocado,
    'support_access_grants',
    grantId,
    { operador_email: data.operator_email },
  );
  return { ok: true };
}
