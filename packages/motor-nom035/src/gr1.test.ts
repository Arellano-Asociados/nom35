import { describe, expect, it } from 'vitest';
import { evaluarGR1 } from './gr1';

// GR-I: identificación de trabajadores sujetos a acontecimientos traumáticos severos.
// Sin puntaje: Sí/No. true = Sí, false = No.
// Sección I con TODAS No → no requiere valoración y el cuestionario termina.
// Con ALGUNA Sí en I: requiere valoración clínica si ≥1 Sí en II, o ≥3 Sí en III, o ≥2 Sí en IV.

const noes = (cantidad: number): boolean[] => Array.from({ length: cantidad }, () => false);
const conSies = (cantidad: number, sies: number): boolean[] =>
  Array.from({ length: cantidad }, (_, i) => i < sies);

describe('evaluarGR1', () => {
  it('caso 7: sin acontecimiento traumático (todas No en Sección I) → no requiere valoración', () => {
    const resultado = evaluarGR1({ seccionI: noes(6) });
    expect(resultado.presentoAcontecimiento).toBe(false);
    expect(resultado.requiereValoracionClinica).toBe(false);
    expect(resultado.seccionesQueDisparan).toEqual([]);
  });

  it('caso 8: Sí en Sección I y ≥2 Sí en Sección IV → requiere valoración clínica', () => {
    const resultado = evaluarGR1({
      seccionI: conSies(6, 1),
      seccionII: noes(2),
      seccionIII: noes(6),
      seccionIV: conSies(5, 2),
    });
    expect(resultado.presentoAcontecimiento).toBe(true);
    expect(resultado.requiereValoracionClinica).toBe(true);
    expect(resultado.seccionesQueDisparan).toEqual(['IV']);
  });

  it('con acontecimiento pero sin síntomas suficientes → no requiere valoración', () => {
    const resultado = evaluarGR1({
      seccionI: conSies(6, 2),
      seccionII: noes(2),
      seccionIII: conSies(6, 2), // 2 < 3
      seccionIV: conSies(5, 1), // 1 < 2
    });
    expect(resultado.presentoAcontecimiento).toBe(true);
    expect(resultado.requiereValoracionClinica).toBe(false);
    expect(resultado.seccionesQueDisparan).toEqual([]);
  });

  it.each([
    ['II', { seccionII: conSies(2, 1), seccionIII: noes(6), seccionIV: noes(5) }],
    ['III', { seccionII: noes(2), seccionIII: conSies(6, 3), seccionIV: noes(5) }],
    ['IV', { seccionII: noes(2), seccionIII: noes(6), seccionIV: conSies(5, 2) }],
  ] as const)('umbral exacto de la sección %s dispara valoración clínica', (seccion, resto) => {
    const resultado = evaluarGR1({ seccionI: conSies(6, 1), ...resto });
    expect(resultado.requiereValoracionClinica).toBe(true);
    expect(resultado.seccionesQueDisparan).toEqual([seccion]);
  });

  it('varias secciones pueden disparar a la vez', () => {
    const resultado = evaluarGR1({
      seccionI: conSies(6, 6),
      seccionII: conSies(2, 2),
      seccionIII: conSies(6, 6),
      seccionIV: conSies(5, 5),
    });
    expect(resultado.seccionesQueDisparan).toEqual(['II', 'III', 'IV']);
  });

  it('rechaza una Sección I vacía', () => {
    expect(() => evaluarGR1({ seccionI: [] })).toThrow(/Sección I/i);
  });

  it('rechaza secciones II–IV respondidas cuando no hubo acontecimiento (el cuestionario termina en I)', () => {
    expect(() => evaluarGR1({ seccionI: noes(6), seccionII: conSies(2, 1) })).toThrow(/termina/i);
  });

  it('rechaza secciones II–IV faltantes cuando SÍ hubo acontecimiento', () => {
    expect(() => evaluarGR1({ seccionI: conSies(6, 1), seccionII: noes(2) })).toThrow(
      /Secci(ó|o)n/i,
    );
  });
});
