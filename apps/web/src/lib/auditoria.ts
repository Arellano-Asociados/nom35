import { clienteAdmin } from './supabase-admin';

// Helper compartido de auditoría. `audit_log` es append-only y es la evidencia exhibible
// ante inspecciones de la STPS (CLAUDE.md §3, regla 5): una sola definición evita que
// panel.ts e informes.ts diverjan en el mapeo de campos.
//
// Dos variantes sobre el mismo INSERT:
// - `registrarAuditoria`: fire-and-forget (Promise<void>); usada por la mayoría de las
//   acciones del panel, donde el evento acompaña una operación que ya ocurrió.
// - `registrarAuditoriaEstricta`: Promise<boolean>; usada donde "sin evento no hay consulta"
//   (regla inviolable 5, acceso individual del Responsable Designado): el caller debe poder
//   bloquear el render si el INSERT falló.

async function insertarAuditoria(
  companyId: string,
  actorUserId: string,
  eventType: string,
  entity?: string,
  entityId?: string,
  details?: Record<string, unknown>,
): Promise<{ error: unknown }> {
  const { error } = await clienteAdmin()
    .from('audit_log')
    .insert({
      company_id: companyId,
      actor_user_id: actorUserId,
      event_type: eventType,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      details: details ?? {},
    });
  return { error };
}

export async function registrarAuditoria(
  companyId: string,
  actorUserId: string,
  eventType: string,
  entity?: string,
  entityId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const { error } = await insertarAuditoria(
    companyId,
    actorUserId,
    eventType,
    entity,
    entityId,
    details,
  );
  if (error) {
    // Excepción justificada a no-console (regla 9 de CLAUDE.md): esto es un error de BD del
    // propio helper de auditoría, no una respuesta ni un resultado de cuestionario. Un fallo
    // silencioso aquí dejaría un hueco invisible en la evidencia exhibible ante la STPS.
    // eslint-disable-next-line no-console
    console.error('No se pudo registrar auditoría:', error);
  }
}

/**
 * Variante estricta: devuelve `false` si el INSERT falló, sin lanzar. Para los flujos donde
 * "sin evento no hay consulta" (regla inviolable 5): el caller debe negar el acceso al dato
 * sensible si no pudo dejar evidencia de la consulta.
 */
export async function registrarAuditoriaEstricta(
  companyId: string,
  actorUserId: string,
  eventType: string,
  entity?: string,
  entityId?: string,
  details?: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await insertarAuditoria(
    companyId,
    actorUserId,
    eventType,
    entity,
    entityId,
    details,
  );
  if (error) {
    // eslint-disable-next-line no-console
    console.error('No se pudo registrar auditoría (variante estricta):', error);
    return false;
  }
  return true;
}
