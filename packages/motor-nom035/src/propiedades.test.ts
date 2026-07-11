import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calificarCuestionario } from './calificacion';
import { GR2, GR3 } from './datos';
import { nivelDeRiesgo } from './niveles';
import type { DefinicionGuia, OpcionLikert, RespuestasCuestionario } from './tipos';

// Caso 11 del plan: para respuestas aleatorias, Cfinal = suma de los dominios de sus ítems
// y cada nivel reportado es consistente con su rango. Se recalcula todo de forma independiente
// en el test (sin reutilizar el código del motor) para detectar errores de transcripción.

const OPCIONES: readonly OpcionLikert[] = [
  'siempre',
  'casi_siempre',
  'algunas_veces',
  'casi_nunca',
  'nunca',
];

interface CasoAleatorio {
  entrada: RespuestasCuestionario;
}

function casoArbitrario(guia: DefinicionGuia): fc.Arbitrary<CasoAleatorio> {
  return fc
    .record({
      opciones: fc.array(fc.constantFrom(...OPCIONES), {
        minLength: guia.totalItems,
        maxLength: guia.totalItems,
      }),
      atiendeClientes: fc.boolean(),
      supervisaPersonal: fc.boolean(),
    })
    .map(({ opciones, atiendeClientes, supervisaPersonal }) => {
      const omitidos = new Set<number>([
        ...(atiendeClientes ? [] : guia.itemsCondicionales.atiendeClientes),
        ...(supervisaPersonal ? [] : guia.itemsCondicionales.supervisaPersonal),
      ]);
      const respuestas: Record<number, OpcionLikert> = {};
      for (let item = 1; item <= guia.totalItems; item++) {
        const opcion = opciones[item - 1];
        if (!omitidos.has(item) && opcion !== undefined) respuestas[item] = opcion;
      }
      return { entrada: { respuestas, atiendeClientes, supervisaPersonal } };
    });
}

/** Recalcula el puntaje de un ítem de forma independiente al motor. */
function puntajeEsperado(guia: DefinicionGuia, entrada: RespuestasCuestionario, item: number) {
  const respuesta = entrada.respuestas[item] ?? 'nunca'; // no aplicable → Nunca
  const directo = OPCIONES.indexOf(respuesta); // siempre=0 … nunca=4
  return guia.grupoDeItem[item] === 'A' ? directo : 4 - directo;
}

describe.each([GR2, GR3])('propiedades del calificador ($guia)', (guia) => {
  it('Cfinal es la suma independiente de los 4·N puntajes y de los dominios', () => {
    fc.assert(
      fc.property(casoArbitrario(guia), ({ entrada }) => {
        const resultado = calificarCuestionario(entrada, guia);

        let sumaIndependiente = 0;
        for (let item = 1; item <= guia.totalItems; item++) {
          sumaIndependiente += puntajeEsperado(guia, entrada, item);
        }
        expect(resultado.cfinal).toBe(sumaIndependiente);

        const sumaDominios = resultado.dominios.reduce((total, d) => total + d.puntaje, 0);
        expect(resultado.cfinal).toBe(sumaDominios);

        expect(resultado.cfinal).toBeGreaterThanOrEqual(0);
        expect(resultado.cfinal).toBeLessThanOrEqual(guia.totalItems * 4);
      }),
      { numRuns: 300 },
    );
  });

  it('cada puntaje de dominio y categoría es la suma de sus ítems y su nivel respeta su rango', () => {
    fc.assert(
      fc.property(casoArbitrario(guia), ({ entrada }) => {
        const resultado = calificarCuestionario(entrada, guia);

        for (const [reportados, definiciones] of [
          [resultado.dominios, guia.dominios],
          [resultado.categorias, guia.categorias],
        ] as const) {
          for (const reportado of reportados) {
            const definicion = definiciones.find((d) => d.nombre === reportado.nombre);
            if (!definicion) throw new Error(`Definición no encontrada: ${reportado.nombre}`);
            const suma = [...definicion.items].reduce(
              (total, item) => total + puntajeEsperado(guia, entrada, item),
              0,
            );
            expect(reportado.puntaje, reportado.nombre).toBe(suma);
            expect(reportado.nivel, reportado.nombre).toBe(
              nivelDeRiesgo(reportado.puntaje, definicion.rango),
            );
          }
        }

        expect(resultado.nivelFinal).toBe(nivelDeRiesgo(resultado.cfinal, guia.rangoCfinal));
      }),
      { numRuns: 300 },
    );
  });
});
