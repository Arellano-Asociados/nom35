import { REGLAS_GR1, type ReglasGR1 } from './datos/gr1';

/** Respuestas a la GR-I. true = Sí, false = No. */
export interface RespuestasGR1 {
  /** Sección I — Acontecimiento traumático severo. */
  seccionI: readonly boolean[];
  /** Sección II — Recuerdos persistentes sobre el acontecimiento (último mes). */
  seccionII?: readonly boolean[];
  /** Sección III — Esfuerzo por evitar circunstancias parecidas o asociadas (último mes). */
  seccionIII?: readonly boolean[];
  /** Sección IV — Afectación (último mes). */
  seccionIV?: readonly boolean[];
}

export type SeccionSintomas = 'II' | 'III' | 'IV';

export interface ResultadoGR1 {
  presentoAcontecimiento: boolean;
  requiereValoracionClinica: boolean;
  seccionesQueDisparan: readonly SeccionSintomas[];
}

export class GR1InvalidoError extends Error {
  override readonly name = 'GR1InvalidoError';
}

/**
 * Evalúa la GR-I. Sin puntaje: resultado binario + secciones que disparan la canalización.
 * - Todas No en Sección I → no requiere valoración; las secciones II–IV no deben venir
 *   respondidas (el cuestionario termina en la Sección I).
 * - Alguna Sí en Sección I → las secciones II–IV son obligatorias; requiere valoración
 *   clínica si alguna alcanza su umbral de respuestas "Sí" (reglas normativas: ≥1 en II,
 *   ≥3 en III, ≥2 en IV).
 */
export function evaluarGR1(
  respuestas: RespuestasGR1,
  reglas: ReglasGR1 = REGLAS_GR1,
): ResultadoGR1 {
  if (respuestas.seccionI.length === 0) {
    throw new GR1InvalidoError('La Sección I no puede venir vacía');
  }

  const presentoAcontecimiento = respuestas.seccionI.some(Boolean);

  if (!presentoAcontecimiento) {
    if (respuestas.seccionII || respuestas.seccionIII || respuestas.seccionIV) {
      throw new GR1InvalidoError(
        'Sin acontecimiento traumático el cuestionario termina en la Sección I; no debe haber respuestas en II–IV',
      );
    }
    return {
      presentoAcontecimiento: false,
      requiereValoracionClinica: false,
      seccionesQueDisparan: [],
    };
  }

  const secciones: { nombre: SeccionSintomas; respuestas: readonly boolean[]; minSi: number }[] = [
    { nombre: 'II', respuestas: respuestas.seccionII ?? [], minSi: reglas.minSiSeccionII },
    { nombre: 'III', respuestas: respuestas.seccionIII ?? [], minSi: reglas.minSiSeccionIII },
    { nombre: 'IV', respuestas: respuestas.seccionIV ?? [], minSi: reglas.minSiSeccionIV },
  ];

  const faltantes = secciones.filter((s) => s.respuestas.length === 0);
  if (faltantes.length > 0) {
    throw new GR1InvalidoError(
      `Con acontecimiento traumático son obligatorias las secciones II–IV; faltan: Sección ${faltantes
        .map((s) => s.nombre)
        .join(', Sección ')}`,
    );
  }

  const seccionesQueDisparan = secciones
    .filter((s) => s.respuestas.filter(Boolean).length >= s.minSi)
    .map((s) => s.nombre);

  return {
    presentoAcontecimiento: true,
    requiereValoracionClinica: seccionesQueDisparan.length > 0,
    seccionesQueDisparan,
  };
}
