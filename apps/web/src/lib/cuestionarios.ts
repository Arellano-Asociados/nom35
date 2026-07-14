/**
 * Dominio de cuestionarios personalizados (Fase 3). Módulo PURO: tipos, validación,
 * lógica condicional y sellado sha256 de la definición. Las guías oficiales NO pasan
 * por aquí: viven en su catálogo sellado con verificar:textos.
 */

export type TipoPregunta = 'likert5' | 'opcion_multiple' | 'si_no' | 'abierta';

export interface PreguntaPersonalizada {
  id: string;
  texto: string;
  tipo: TipoPregunta;
  /** Solo para opcion_multiple. */
  opciones?: string[];
}

export interface SeccionPersonalizada {
  id: string;
  titulo: string;
  /** Mostrar esta sección solo si la respuesta a preguntaId (de una sección ANTERIOR) es valor. */
  condicion?: { preguntaId: string; valor: string };
  preguntas: PreguntaPersonalizada[];
}

export interface DefinicionCuestionario {
  secciones: SeccionPersonalizada[];
}

export const OPCIONES_LIKERT5 = [
  'siempre',
  'casi_siempre',
  'algunas_veces',
  'casi_nunca',
  'nunca',
] as const;

export type ResultadoValidacion = { ok: true } | { ok: false; errores: string[] };

/** Validación estricta (se exige al PUBLICAR; los borradores pueden estar a medias). */
export function validarDefinicion(def: DefinicionCuestionario): ResultadoValidacion {
  const errores: string[] = [];
  if (!Array.isArray(def.secciones) || def.secciones.length === 0) {
    errores.push('El cuestionario necesita al menos una sección.');
  }

  const idsVistos = new Set<string>();
  const preguntasAnteriores = new Map<string, PreguntaPersonalizada>();

  for (const [i, seccion] of (def.secciones ?? []).entries()) {
    const n = i + 1;
    if (!seccion.titulo?.trim()) errores.push(`La sección ${n} no tiene título.`);
    if (!Array.isArray(seccion.preguntas) || seccion.preguntas.length === 0) {
      errores.push(`La sección ${n} no tiene preguntas.`);
    }
    if (seccion.condicion) {
      const previa = preguntasAnteriores.get(seccion.condicion.preguntaId);
      if (!previa) {
        errores.push(
          `La condición de la sección ${n} apunta a una pregunta que no existe en secciones anteriores.`,
        );
      } else if (previa.tipo === 'abierta') {
        errores.push(`La condición de la sección ${n} no puede depender de una pregunta abierta.`);
      }
      if (!seccion.condicion.valor?.trim()) {
        errores.push(`La condición de la sección ${n} no tiene valor.`);
      }
    }
    for (const pregunta of seccion.preguntas ?? []) {
      if (idsVistos.has(pregunta.id)) {
        errores.push(`Hay preguntas con el mismo identificador (${pregunta.id}).`);
      }
      idsVistos.add(pregunta.id);
      if (!pregunta.texto?.trim()) errores.push(`Una pregunta de la sección ${n} no tiene texto.`);
      if (pregunta.tipo === 'opcion_multiple') {
        const opciones = (pregunta.opciones ?? []).map((o) => o.trim()).filter(Boolean);
        if (opciones.length < 2) {
          errores.push(
            `Una pregunta de opción múltiple de la sección ${n} necesita al menos 2 opciones.`,
          );
        }
      }
    }
    // Las preguntas de esta sección quedan disponibles como condición de las SIGUIENTES.
    for (const pregunta of seccion.preguntas ?? []) preguntasAnteriores.set(pregunta.id, pregunta);
  }

  return errores.length === 0 ? { ok: true } : { ok: false, errores };
}

/** Secciones visibles dadas las respuestas actuales (lógica condicional básica). */
export function seccionesVisibles(
  def: DefinicionCuestionario,
  respuestas: Record<string, string>,
): SeccionPersonalizada[] {
  return def.secciones.filter(
    (s) => !s.condicion || respuestas[s.condicion.preguntaId] === s.condicion.valor,
  );
}

/** Valores válidos para una pregunta (validación de servidor al guardar respuestas). */
export function respuestaValida(pregunta: PreguntaPersonalizada, valor: string): boolean {
  if (pregunta.tipo === 'abierta') return valor.trim().length > 0 && valor.length <= 4000;
  if (pregunta.tipo === 'si_no') return valor === 'si' || valor === 'no';
  if (pregunta.tipo === 'likert5') return (OPCIONES_LIKERT5 as readonly string[]).includes(valor);
  return (pregunta.opciones ?? []).includes(valor);
}

/** Mapa id→pregunta para validaciones y reporte. */
export function preguntasPorId(def: DefinicionCuestionario): Map<string, PreguntaPersonalizada> {
  const mapa = new Map<string, PreguntaPersonalizada>();
  for (const s of def.secciones) for (const p of s.preguntas) mapa.set(p.id, p);
  return mapa;
}
