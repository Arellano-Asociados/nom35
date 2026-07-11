// GR-I — Cuestionario para identificar a los trabajadores que fueron sujetos a
// acontecimientos traumáticos severos (aplica a TODOS los centros de trabajo).
// Fuente: NOM-035-STPS-2018, DOF 23-oct-2018 (Guía de Referencia I).
//
// Sin puntaje: respuestas Sí/No. Umbral mínimo de respuestas "Sí" por sección que dispara
// la necesidad de valoración clínica (solo se evalúan II–IV si hubo algún Sí en la Sección I).

export interface ReglasGR1 {
  /** Sección II — Recuerdos persistentes sobre el acontecimiento. */
  minSiSeccionII: number;
  /** Sección III — Esfuerzo por evitar circunstancias parecidas o asociadas. */
  minSiSeccionIII: number;
  /** Sección IV — Afectación. */
  minSiSeccionIV: number;
}

export const REGLAS_GR1: ReglasGR1 = {
  minSiSeccionII: 1,
  minSiSeccionIII: 3,
  minSiSeccionIV: 2,
};
