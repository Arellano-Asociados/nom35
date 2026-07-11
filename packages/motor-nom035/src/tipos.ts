// Tipos del motor de cálculo NOM-035-STPS-2018.
// Regla inviolable 7: los VALORES normativos (matrices, grupos, rangos) llegan como datos
// (tablas scoring_rules / item_structure / risk_level_ranges); aquí solo viven sus FORMAS.

export type NivelRiesgo = 'nulo' | 'bajo' | 'medio' | 'alto' | 'muy_alto';

export type OpcionLikert = 'siempre' | 'casi_siempre' | 'algunas_veces' | 'casi_nunca' | 'nunca';

/** Grupo de calificación de un ítem: A = directo (Siempre=0), B = inverso (Siempre=4). */
export type GrupoCalificacion = 'A' | 'B';

/**
 * Cortes de la regla de niveles compartida:
 * puntaje < nuloMax → nulo; < bajoMax → bajo; < medioMax → medio; < altoMax → alto; ≥ altoMax → muy_alto.
 */
export interface RangoNiveles {
  nuloMax: number;
  bajoMax: number;
  medioMax: number;
  altoMax: number;
}

export type TipoGuia = 'GR-II' | 'GR-III';

export interface DominioDef {
  nombre: string;
  items: readonly number[];
  rango: RangoNiveles;
}

export interface CategoriaDef {
  nombre: string;
  /** Dominios que pertenecen a la categoría (por nombre). */
  dominios: readonly string[];
  /**
   * Ítems que puntúan para la categoría. Se listan explícitos porque en la GR-II la categoría
   * "Factores propios de la actividad" NO incluye los ítems 18 y 19 de su dominio Falta de control.
   */
  items: readonly number[];
  rango: RangoNiveles;
}

/** Definición completa de una guía (contenido de las tablas de datos normativos). */
export interface DefinicionGuia {
  guia: TipoGuia;
  totalItems: number;
  /** scoring_rules: valor de cada opción según el grupo del ítem. */
  puntajes: Record<GrupoCalificacion, Record<OpcionLikert, number>>;
  /** item_structure: número de ítem → grupo de calificación. */
  grupoDeItem: Readonly<Record<number, GrupoCalificacion>>;
  /** Ítems condicionales: solo aplican según las preguntas filtro. */
  itemsCondicionales: {
    atiendeClientes: readonly number[];
    supervisaPersonal: readonly number[];
  };
  dominios: readonly DominioDef[];
  categorias: readonly CategoriaDef[];
  /** risk_level_ranges para la calificación final del cuestionario. */
  rangoCfinal: RangoNiveles;
}

/** Respuestas de un trabajador a una guía GR-II o GR-III. */
export interface RespuestasCuestionario {
  /** número de ítem → opción elegida. Los condicionales no aplicables se omiten. */
  respuestas: Readonly<Record<number, OpcionLikert>>;
  atiendeClientes: boolean;
  supervisaPersonal: boolean;
}

export interface PuntajeConNivel {
  nombre: string;
  puntaje: number;
  nivel: NivelRiesgo;
}

export interface ResultadoCalificacion {
  guia: TipoGuia;
  cfinal: number;
  nivelFinal: NivelRiesgo;
  categorias: readonly PuntajeConNivel[];
  dominios: readonly PuntajeConNivel[];
}
