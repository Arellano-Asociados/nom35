// Lógica pura de estados de organización (spec §2.1). pending_deletion NO pasa directo
// a active: el arrepentimiento revierte a suspended (detiene el reloj de purga) y la
// reactivación es una decisión separada — dos actos, dos eventos en la bitácora.

export type EstadoEmpresa = 'active' | 'suspended' | 'pending_deletion';

const TRANSICIONES: Record<EstadoEmpresa, EstadoEmpresa[]> = {
  active: ['suspended', 'pending_deletion'],
  suspended: ['active', 'pending_deletion'],
  pending_deletion: ['suspended'],
};

export function transicionEmpresaValida(de: EstadoEmpresa, a: EstadoEmpresa): boolean {
  return TRANSICIONES[de].includes(a);
}

/** Días de retención en pending_deletion antes de que la purga manual sea admisible.
 * Constante fácil de cambiar cuando el abogado fije el criterio (decisión sellada 4). */
export const RETENCION_DIAS = 90;
