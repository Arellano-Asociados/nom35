// Programa de intervención (NOM-035 8.3/8.4/8.5). Lógica pura sobre los criterios
// de la Tabla 4 (Guía II) / Tabla 7 (Guía III), que viven como DATOS en
// system_config key 'criterios_toma_acciones' (regla inviolable 7: nada normativo
// hardcodeado). Estas funciones reciben los criterios; no los conocen.

export type NivelAccion = 'primer_nivel' | 'segundo_nivel' | 'tercer_nivel';

export const ETIQUETA_NIVEL_ACCION: Record<NivelAccion, string> = {
  primer_nivel: 'Primer nivel (organizacional)',
  segundo_nivel: 'Segundo nivel (grupal)',
  tercer_nivel: 'Tercer nivel (individual / clínico)',
};

export interface AccionSugeridaConfig {
  descripcion: string;
  nivel_accion: NivelAccion | null;
}

export interface CriteriosTomaAcciones {
  titulo: string;
  fuente: string;
  /** Niveles que exigen Programa de intervención (II.4/III.4: medio, alto, muy alto). */
  exigenPrograma: string[];
  niveles: Record<string, { criterio: string; accionesSugeridas: AccionSugeridaConfig[] }>;
}

export interface AccionPrePoblada {
  descripcion: string;
  nivelAccion: NivelAccion | null;
  /** Nivel de riesgo detectado que la origina (para origin_level). */
  nivelOrigen: string;
}

/** Severidad para ordenar/deduplicar (mayor índice = más severo). */
const ORDEN_NIVELES = ['nulo', 'bajo', 'medio', 'alto', 'muy_alto'];

/**
 * ¿El ciclo exige un Programa de intervención? True si algún nivel detectado
 * (Cfinal, categoría o dominio de resultados vigentes) está en la lista que los
 * criterios marcan como obligatoria.
 */
export function exigePrograma(
  nivelesPresentes: readonly string[],
  criterios: CriteriosTomaAcciones,
): boolean {
  return nivelesPresentes.some((nivel) => criterios.exigenPrograma.includes(nivel));
}

/**
 * Acciones pre-pobladas para el programa: las sugeridas por cada nivel PRESENTE
 * que exige programa, deduplicadas por descripción quedándose con la aparición
 * del nivel más severo. Devueltas de más a menos severo.
 */
export function accionesPrePobladas(
  nivelesPresentes: readonly string[],
  criterios: CriteriosTomaAcciones,
): AccionPrePoblada[] {
  const presentes = new Set(nivelesPresentes);
  const relevantes = [...criterios.exigenPrograma]
    .filter((nivel) => presentes.has(nivel))
    .sort((a, b) => ORDEN_NIVELES.indexOf(b) - ORDEN_NIVELES.indexOf(a));

  const porDescripcion = new Map<string, AccionPrePoblada>();
  for (const nivel of relevantes) {
    for (const sugerida of criterios.niveles[nivel]?.accionesSugeridas ?? []) {
      if (!porDescripcion.has(sugerida.descripcion)) {
        porDescripcion.set(sugerida.descripcion, {
          descripcion: sugerida.descripcion,
          nivelAccion: sugerida.nivel_accion,
          nivelOrigen: nivel,
        });
      }
    }
  }
  return [...porDescripcion.values()];
}
