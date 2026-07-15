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

/**
 * Catálogo cerrado de eventos de auditoría (auditoría v0: antes eran 14 literales sueltos
 * y `eventType: string` aceptaba cualquier cosa). Un typo no fallaba en compilación ni en
 * tests y FRAGMENTABA la evidencia: el resumen del expediente cuenta por `event_type`
 * textual, así que un `individual_result_acess` desaparecía del conteo sin que nadie lo
 * notara hasta una inspección. Con el union type, ese typo ya no compila.
 */
export const EVENTOS_AUDITORIA = {
  empresaCreada: 'empresa_creada',
  empleadosImportados: 'empleados_importados',
  rdDesignado: 'rd_designado',
  consultorAsignado: 'consultor_asignado',
  cicloCreado: 'ciclo_creado',
  cicloDistribuido: 'ciclo_distribuido',
  recordatoriosEnviados: 'recordatorios_enviados',
  canalizacionActualizada: 'canalizacion_actualizada',
  politicaPublicada: 'politica_publicada',
  informeGenerado: 'informe_generado',
  informeDescargado: 'informe_descargado',
  expedienteGenerado: 'expediente_generado',
  gr1NotificacionDr: 'gr1_notificacion_dr',
  /** Regla 5: consulta de un resultado individual por el Responsable Designado. */
  accesoResultadoIndividual: 'individual_result_access',
  /** El titular consulta su propio resultado con su enlace. */
  resultadoPropioConsultado: 'resultado_propio_consultado',
  // Cuestionarios personalizados (Fase 3)
  cuestionarioPublicado: 'cuestionario_publicado',
  cuestionarioArchivado: 'cuestionario_archivado',
  cuestionarioDistribuido: 'cuestionario_distribuido',
  // Ciclo normativo completo (Fase 4)
  /** Se publicó una constancia de difusión de resultados (5.7 e / 7.8). */
  difusionPublicada: 'difusion_publicada',
  /** Un trabajador acusó "Enterado" sobre una constancia de difusión. */
  difusionAcusada: 'difusion_acusada',
  /** Se creó o rotó el enlace del buzón de quejas (8.1 b). */
  buzonEnlaceRotado: 'buzon_enlace_rotado',
  /** Entró una queja al buzón (actor sistema; details SIN contenido). */
  quejaRecibida: 'queja_recibida',
  /** Regla 5 extendida: lectura del CONTENIDO de una queja (fail-closed). */
  quejaConsultada: 'queja_consultada',
  /** Cambio de estado de una queja con nota de seguimiento (8.2 g). */
  quejaActualizada: 'queja_actualizada',
  /** Se creó el Programa de intervención del ciclo (8.3/8.4). */
  programaCreado: 'programa_creado',
  /** Se editaron los campos 8.4 del Programa. */
  programaActualizado: 'programa_actualizado',
  /** Se adjuntó evidencia de avance a una acción del Programa. */
  evidenciaAccionSubida: 'evidencia_accion_subida',
  // Acontecimientos traumáticos severos y registros del 5.8 (Fase 4.5)
  /** Se registró un acontecimiento traumático severo (5.3/5.5). */
  eventoAtsRegistrado: 'evento_ats_registrado',
  /** Se aplicó la GR-I a los trabajadores expuestos a un ATS (6.5). */
  eventoAtsDistribuido: 'evento_ats_distribuido',
  /** El RD generó el registro de resultados del 5.8 a) (datos de salud por persona). */
  registro58aGenerado: 'registro_58a_generado',
  /** El RD generó el registro de trabajadores examinados del 5.8 c). */
  registro58cGenerado: 'registro_58c_generado',
  // Actos de PLATAFORMA sobre este tenant (Fase 5, doble bitácora: el cliente tiene
  // derecho a ver en SU bitácora que la plataforma actuó sobre él; actor = operador).
  /** La plataforma suspendió la organización (solo lectura hasta reactivar). */
  empresaSuspendida: 'empresa_suspendida',
  /** La plataforma reactivó la organización. */
  empresaReactivada: 'empresa_reactivada',
  /** Inició la baja: 90 días de retención en solo lectura antes de la purga. */
  empresaBajaSolicitada: 'empresa_baja_solicitada',
  /** La plataforma cambió un feature flag de este tenant (valor anterior → nuevo). */
  flagActualizado: 'flag_actualizado',
  /** Un admin del tenant otorgó acceso de soporte NOMINATIVO a un operador. */
  soporteAccesoOtorgado: 'soporte_acceso_otorgado',
  /** Se revocó un acceso de soporte (por el tenant o por el propio operador). */
  soporteAccesoRevocado: 'soporte_acceso_revocado',
  /** Regla 5 aplicada a la plataforma: cada página de la vista de soporte queda aquí. */
  soporteVistaConsultada: 'soporte_vista_consultada',
} as const;

export type EventoAuditoria = (typeof EVENTOS_AUDITORIA)[keyof typeof EVENTOS_AUDITORIA];

async function insertarAuditoria(
  companyId: string,
  actorUserId: string,
  eventType: EventoAuditoria,
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
  eventType: EventoAuditoria,
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
  eventType: EventoAuditoria,
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
