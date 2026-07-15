import { clienteAdmin } from './supabase-admin';

// Bitácora de PLATAFORMA (`platform_audit_log`), espejo de lib/auditoria.ts. Tabla
// separada de `audit_log` (spec §4): lectores disjuntos (el tenant jamás la lee),
// retención opuesta (sobrevive a la purga del tenant como acta). El único camino de
// escritura es service_role tras autorizarPlataforma() — la tabla no tiene GRANTs para
// authenticated.
//
// Regla de doble escritura: todo evento de plataforma que afecta a UN tenant (flag,
// suspensión, baja, grant) va AQUÍ (variante estricta: sin evento no hay mutación) Y al
// `audit_log` del tenant (fire-and-forget, vía lib/auditoria.ts) — el cliente tiene
// derecho a ver en su propia bitácora que la plataforma actuó sobre él.

/** Catálogo cerrado (mismo razonamiento que EVENTOS_AUDITORIA: un typo fragmenta la evidencia). */
export const EVENTOS_PLATAFORMA = {
  operadorCreadoBootstrap: 'operador_creado_bootstrap',
  operadorInvitado: 'operador_invitado',
  operadorActivado: 'operador_activado',
  operadorDeshabilitado: 'operador_deshabilitado',
  empresaCreadaPorPlataforma: 'empresa_creada_por_plataforma',
  empresaSuspendida: 'empresa_suspendida',
  empresaReactivada: 'empresa_reactivada',
  empresaBajaSolicitada: 'empresa_baja_solicitada',
  avisoRetencionEnviado: 'aviso_retencion_enviado',
  empresaPurgada: 'empresa_purgada',
  flagActualizado: 'flag_actualizado',
  soporteAccesoSolicitado: 'soporte_acceso_solicitado',
} as const;

export type EventoPlataforma = (typeof EVENTOS_PLATAFORMA)[keyof typeof EVENTOS_PLATAFORMA];

async function insertarAuditoriaPlataforma(
  operadorId: string | null, // null = actor sistema (cron de retención, scripts)
  eventType: EventoPlataforma,
  companyId?: string,
  entity?: string,
  entityId?: string,
  details?: Record<string, unknown>,
): Promise<{ error: unknown }> {
  const { error } = await clienteAdmin()
    .from('platform_audit_log')
    .insert({
      operator_id: operadorId,
      event_type: eventType,
      company_id: companyId ?? null,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      details: details ?? {},
    });
  return { error };
}

export async function registrarAuditoriaPlataforma(
  operadorId: string | null,
  eventType: EventoPlataforma,
  companyId?: string,
  entity?: string,
  entityId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const { error } = await insertarAuditoriaPlataforma(
    operadorId,
    eventType,
    companyId,
    entity,
    entityId,
    details,
  );
  if (error) {
    // Misma excepción justificada a no-console que lib/auditoria.ts: fallo del propio
    // helper de bitácora, sin datos de salud.
    // eslint-disable-next-line no-console
    console.error('No se pudo registrar auditoría de plataforma:', error);
  }
}

/** Variante estricta: `false` si el INSERT falló. Para "sin evento no hay mutación". */
export async function registrarAuditoriaPlataformaEstricta(
  operadorId: string | null,
  eventType: EventoPlataforma,
  companyId?: string,
  entity?: string,
  entityId?: string,
  details?: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await insertarAuditoriaPlataforma(
    operadorId,
    eventType,
    companyId,
    entity,
    entityId,
    details,
  );
  if (error) {
    // eslint-disable-next-line no-console
    console.error('No se pudo registrar auditoría de plataforma (variante estricta):', error);
    return false;
  }
  return true;
}
