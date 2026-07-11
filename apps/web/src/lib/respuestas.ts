import type {
  DefinicionGuia,
  OpcionLikert,
  RespuestasCuestionario,
  RespuestasGR1,
} from '@nom35/motor-nom035';

/** Fila de la tabla responses relevante para reconstruir el estado de un cuestionario. */
export interface FilaRespuesta {
  id: string;
  section: string | null;
  item_number: number;
  answer: string;
  answered_at: string;
}

const OPCIONES_LIKERT: readonly OpcionLikert[] = [
  'siempre',
  'casi_siempre',
  'algunas_veces',
  'casi_nunca',
  'nunca',
];

const claveDe = (fila: Pick<FilaRespuesta, 'section' | 'item_number'>): string =>
  fila.section ? `${fila.section}:${fila.item_number}` : String(fila.item_number);

/**
 * Reduce el historial append-only a la respuesta VIGENTE de cada ítem: la fila con
 * answered_at más reciente (desempate por id, que crece con la inserción).
 * Clave del mapa: "N" para guías Likert, "SECCION:N" para GR-I.
 */
export function ultimaRespuestaPorItem(
  filas: readonly FilaRespuesta[],
): Map<string, FilaRespuesta> {
  const vigentes = new Map<string, FilaRespuesta>();
  for (const fila of filas) {
    const clave = claveDe(fila);
    const actual = vigentes.get(clave);
    if (
      !actual ||
      fila.answered_at > actual.answered_at ||
      (fila.answered_at === actual.answered_at && fila.id > actual.id)
    ) {
      vigentes.set(clave, fila);
    }
  }
  return vigentes;
}

export interface Filtros {
  atiendeClientes: boolean;
  supervisaPersonal: boolean;
}

/**
 * Construye la entrada del motor para GR-II/GR-III a partir del historial de respuestas.
 * Los condicionales que no aplican según los filtros se descartan (el motor los registra
 * como "Nunca"); la completitud la valida el motor.
 */
export function construirEntradaLikert(
  filas: readonly FilaRespuesta[],
  guia: DefinicionGuia,
  filtros: Filtros,
): RespuestasCuestionario {
  const noAplican = new Set<number>([
    ...(filtros.atiendeClientes ? [] : guia.itemsCondicionales.atiendeClientes),
    ...(filtros.supervisaPersonal ? [] : guia.itemsCondicionales.supervisaPersonal),
  ]);

  const respuestas: Record<number, OpcionLikert> = {};
  for (const [, fila] of ultimaRespuestaPorItem(filas)) {
    if (fila.section !== null) {
      throw new Error(`La ${guia.guia} no tiene secciones; ítem ${fila.item_number} inválido`);
    }
    if (noAplican.has(fila.item_number)) continue;
    if (!OPCIONES_LIKERT.includes(fila.answer as OpcionLikert)) {
      throw new Error(`Respuesta inválida en el ítem ${fila.item_number}: ${fila.answer}`);
    }
    respuestas[fila.item_number] = fila.answer as OpcionLikert;
  }
  return { respuestas, ...filtros };
}

export interface ConteosGR1 {
  I: number;
  II: number;
  III: number;
  IV: number;
}

/**
 * Construye la entrada de evaluarGR1. Cada sección respondida debe estar completa según
 * el número de preguntas del catálogo; las secciones II–IV solo se incluyen si tienen filas
 * (el motor valida su obligatoriedad cuando hubo acontecimiento).
 */
export function construirEntradaGR1(
  filas: readonly FilaRespuesta[],
  conteos: ConteosGR1,
): RespuestasGR1 {
  const vigentes = ultimaRespuestaPorItem(filas);

  const seccion = (s: keyof ConteosGR1): boolean[] | undefined => {
    const total = conteos[s];
    const valores: boolean[] = [];
    const faltantes: number[] = [];
    let respondidas = 0;
    for (let i = 1; i <= total; i++) {
      const fila = vigentes.get(`${s}:${i}`);
      if (!fila) {
        faltantes.push(i);
        continue;
      }
      if (fila.answer !== 'si' && fila.answer !== 'no') {
        throw new Error(`Respuesta inválida en la Sección ${s}, ítem ${i}: ${fila.answer}`);
      }
      respondidas++;
      valores[i - 1] = fila.answer === 'si';
    }
    if (respondidas === 0) return undefined;
    if (faltantes.length > 0) {
      throw new Error(`Sección ${s} incompleta: faltan los ítems ${faltantes.join(', ')}`);
    }
    return valores;
  };

  const seccionI = seccion('I');
  if (!seccionI) {
    throw new Error('Sección I sin respuestas');
  }
  const seccionII = seccion('II');
  const seccionIII = seccion('III');
  const seccionIV = seccion('IV');

  return {
    seccionI,
    ...(seccionII ? { seccionII } : {}),
    ...(seccionIII ? { seccionIII } : {}),
    ...(seccionIV ? { seccionIV } : {}),
  };
}
