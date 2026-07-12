import { clienteAdmin } from '@/lib/supabase-admin';

// Helper compartido de auditoría. `audit_log` es append-only y es la evidencia exhibible
// ante inspecciones de la STPS (CLAUDE.md §3, regla 5): una sola definición evita que
// panel.ts e informes.ts diverjan en el mapeo de campos.

export async function registrarAuditoria(
  companyId: string,
  actorUserId: string,
  eventType: string,
  entity?: string,
  entityId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
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
  if (error) {
    // Excepción justificada a no-console (regla 9 de CLAUDE.md): esto es un error de BD del
    // propio helper de auditoría, no una respuesta ni un resultado de cuestionario. Un fallo
    // silencioso aquí dejaría un hueco invisible en la evidencia exhibible ante la STPS.
    // eslint-disable-next-line no-console
    console.error('No se pudo registrar auditoría:', error);
  }
}
