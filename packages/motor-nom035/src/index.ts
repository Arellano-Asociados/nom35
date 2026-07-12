// Motor de cálculo NOM-035-STPS-2018.
// Funciones puras, sin I/O. Los valores normativos (matrices, grupos, rangos) llegan como
// datos (src/datos/ = contenido seed de scoring_rules / item_structure / risk_level_ranges).

// 0.2.0: corrección normativa GR-II — los ítems 18 y 19 puntúan en la categoría
// "Factores propios de la actividad" (Tabla 3 del DOF 23-oct-2018). Los risk_results
// calculados con engine_version 0.1.0 en centros GR-II subcalifican esa categoría.
export const MOTOR_NOM035_VERSION = '0.2.0';

export type {
  CategoriaDef,
  DefinicionGuia,
  DominioDef,
  GrupoCalificacion,
  NivelRiesgo,
  OpcionLikert,
  PuntajeConNivel,
  RangoNiveles,
  RespuestasCuestionario,
  ResultadoCalificacion,
  TipoGuia,
} from './tipos';

export { nivelDeRiesgo } from './niveles';
export { calificarCuestionario, CuestionarioInvalidoError } from './calificacion';
export {
  evaluarGR1,
  GR1InvalidoError,
  type RespuestasGR1,
  type ResultadoGR1,
  type SeccionSintomas,
} from './gr1';
export { GR2, GR3, PUNTAJES_LIKERT, REGLAS_GR1, type ReglasGR1 } from './datos';
