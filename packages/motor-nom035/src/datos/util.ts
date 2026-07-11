import type { GrupoCalificacion } from '../tipos';

export const serie = (desde: number, hasta: number): number[] =>
  Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

/** Construye el mapa ítem→grupo a partir de la lista del grupo A. */
export function gruposDesdeA(
  totalItems: number,
  itemsGrupoA: readonly number[],
): Readonly<Record<number, GrupoCalificacion>> {
  const setA = new Set(itemsGrupoA);
  const mapa: Record<number, GrupoCalificacion> = {};
  for (const item of serie(1, totalItems)) {
    mapa[item] = setA.has(item) ? 'A' : 'B';
  }
  return mapa;
}
