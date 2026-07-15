// Etiquetas es-MX de los estados de organización para las superficies del portal.

export const ETIQUETA_ESTADO: Record<string, { texto: string; clase: string }> = {
  active: { texto: 'Activa', clase: 'text-emerald-700' },
  suspended: { texto: 'Suspendida', clase: 'text-amber-700' },
  pending_deletion: { texto: 'En baja (retención)', clase: 'text-peligro' },
};
