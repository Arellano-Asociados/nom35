import { nivelDeRiesgo } from './niveles';
import type {
  DefinicionGuia,
  PuntajeConNivel,
  RespuestasCuestionario,
  ResultadoCalificacion,
} from './tipos';

/** Falla de validación de un cuestionario (incompleto, ítems desconocidos o no aplicables). */
export class CuestionarioInvalidoError extends Error {
  override readonly name = 'CuestionarioInvalidoError';
}

/**
 * Califica un cuestionario GR-II o GR-III según la definición normativa recibida.
 * Función pura: no hace I/O ni conoce la fuente de los datos normativos.
 *
 * Reglas aplicadas:
 * - Completitud estricta: todo ítem aplicable debe estar respondido (caso 9 del plan).
 * - Ítems condicionales que no aplican: deben venir SIN respuesta y se puntúan como
 *   "Nunca" (caso 10 del plan; en las guías todos los condicionales son grupo B → 0 puntos).
 * - Grupo A directo / grupo B inverso según `guia.puntajes` (scoring_rules).
 */
export function calificarCuestionario(
  entrada: RespuestasCuestionario,
  guia: DefinicionGuia,
): ResultadoCalificacion {
  const puntajePorItem = validarYPuntuar(entrada, guia);

  const suma = (items: readonly number[]): number =>
    items.reduce((total, item) => total + (puntajePorItem.get(item) ?? 0), 0);

  const dominios: PuntajeConNivel[] = guia.dominios.map((dominio) => {
    const puntaje = suma(dominio.items);
    return { nombre: dominio.nombre, puntaje, nivel: nivelDeRiesgo(puntaje, dominio.rango) };
  });

  const categorias: PuntajeConNivel[] = guia.categorias.map((categoria) => {
    const puntaje = suma(categoria.items);
    return { nombre: categoria.nombre, puntaje, nivel: nivelDeRiesgo(puntaje, categoria.rango) };
  });

  const cfinal = suma(Array.from({ length: guia.totalItems }, (_, indice) => indice + 1));

  return {
    guia: guia.guia,
    cfinal,
    nivelFinal: nivelDeRiesgo(cfinal, guia.rangoCfinal),
    categorias,
    dominios,
  };
}

function validarYPuntuar(
  entrada: RespuestasCuestionario,
  guia: DefinicionGuia,
): Map<number, number> {
  const noAplican = new Set<number>([
    ...(entrada.atiendeClientes ? [] : guia.itemsCondicionales.atiendeClientes),
    ...(entrada.supervisaPersonal ? [] : guia.itemsCondicionales.supervisaPersonal),
  ]);

  const desconocidos = Object.keys(entrada.respuestas)
    .map(Number)
    .filter((item) => !Number.isInteger(item) || item < 1 || item > guia.totalItems);
  if (desconocidos.length > 0) {
    throw new CuestionarioInvalidoError(
      `Ítems desconocidos para la ${guia.guia}: ${desconocidos.join(', ')}`,
    );
  }

  const faltantes: number[] = [];
  const noAplicablesRespondidos: number[] = [];
  const puntajes = new Map<number, number>();

  for (let item = 1; item <= guia.totalItems; item++) {
    const grupo = guia.grupoDeItem[item];
    if (!grupo) {
      throw new CuestionarioInvalidoError(
        `La definición de la ${guia.guia} no asigna grupo al ítem ${item}`,
      );
    }
    const respuesta = entrada.respuestas[item];
    if (noAplican.has(item)) {
      if (respuesta !== undefined) {
        noAplicablesRespondidos.push(item);
      } else {
        // Regla normativa: los condicionales que no aplican se registran como "Nunca".
        puntajes.set(item, guia.puntajes[grupo].nunca);
      }
      continue;
    }
    if (respuesta === undefined) {
      faltantes.push(item);
    } else {
      puntajes.set(item, guia.puntajes[grupo][respuesta]);
    }
  }

  if (noAplicablesRespondidos.length > 0) {
    throw new CuestionarioInvalidoError(
      `Respuestas a ítems condicionales que no aplican en la ${guia.guia}: ${noAplicablesRespondidos.join(', ')}`,
    );
  }
  if (faltantes.length > 0) {
    throw new CuestionarioInvalidoError(
      `Cuestionario ${guia.guia} incompleto: faltan los ítems ${faltantes.join(', ')}`,
    );
  }

  return puntajes;
}
