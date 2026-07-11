import { describe, expect, it } from 'vitest';
import { nivelDeRiesgo } from './niveles';
import type { RangoNiveles } from './tipos';

// Regla de niveles compartida (NOM-035):
// puntaje < nulo_max → nulo; < bajo_max → bajo; < medio_max → medio; < alto_max → alto; ≥ alto_max → muy_alto
describe('nivelDeRiesgo', () => {
  // Rango de Cfinal de la GR-III como caso representativo
  const rango: RangoNiveles = { nuloMax: 50, bajoMax: 75, medioMax: 99, altoMax: 140 };

  it('clasifica los límites exactos de la GR-III (caso 3 del plan)', () => {
    expect(nivelDeRiesgo(0, rango)).toBe('nulo');
    expect(nivelDeRiesgo(49, rango)).toBe('nulo');
    expect(nivelDeRiesgo(50, rango)).toBe('bajo');
    expect(nivelDeRiesgo(74, rango)).toBe('bajo');
    expect(nivelDeRiesgo(75, rango)).toBe('medio');
    expect(nivelDeRiesgo(98, rango)).toBe('medio');
    expect(nivelDeRiesgo(99, rango)).toBe('alto');
    expect(nivelDeRiesgo(139, rango)).toBe('alto');
    expect(nivelDeRiesgo(140, rango)).toBe('muy_alto');
    expect(nivelDeRiesgo(288, rango)).toBe('muy_alto');
  });

  it('rechaza puntajes negativos', () => {
    expect(() => nivelDeRiesgo(-1, rango)).toThrow(/negativo/i);
  });
});
