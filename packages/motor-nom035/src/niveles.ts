import type { NivelRiesgo, RangoNiveles } from './tipos';

/**
 * Regla de niveles compartida de la NOM-035:
 * puntaje < nuloMax → nulo; < bajoMax → bajo; < medioMax → medio; < altoMax → alto; ≥ altoMax → muy_alto.
 */
export function nivelDeRiesgo(puntaje: number, rango: RangoNiveles): NivelRiesgo {
  if (puntaje < 0) {
    throw new RangeError(`El puntaje no puede ser negativo (recibido: ${puntaje})`);
  }
  if (puntaje < rango.nuloMax) return 'nulo';
  if (puntaje < rango.bajoMax) return 'bajo';
  if (puntaje < rango.medioMax) return 'medio';
  if (puntaje < rango.altoMax) return 'alto';
  return 'muy_alto';
}
