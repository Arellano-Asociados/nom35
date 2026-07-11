import type { GrupoCalificacion, OpcionLikert } from '../tipos';

/**
 * scoring_rules — Valor de cada opción de respuesta según el grupo del ítem
 * (DOF 23-oct-2018, guías II y III):
 * Grupo A: calificación directa (Siempre=0 … Nunca=4).
 * Grupo B: calificación inversa (Siempre=4 … Nunca=0).
 */
export const PUNTAJES_LIKERT: Record<GrupoCalificacion, Record<OpcionLikert, number>> = {
  A: { siempre: 0, casi_siempre: 1, algunas_veces: 2, casi_nunca: 3, nunca: 4 },
  B: { siempre: 4, casi_siempre: 3, algunas_veces: 2, casi_nunca: 1, nunca: 0 },
};
