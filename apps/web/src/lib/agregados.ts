import type { NivelRiesgo } from '@nom35/motor-nom035';

// Reglas inviolables 2 y 3: los agregados son distribuciones y conteos (JAMÁS promedios
// entre empleados) y toda celda con 0 < n < 3 se suprime (anti-reidentificación).

export const NIVELES: readonly NivelRiesgo[] = ['nulo', 'bajo', 'medio', 'alto', 'muy_alto'];

export interface CeldaAgregado {
  n: number | null;
  porcentaje: number | null;
  suprimida: boolean;
}

export interface Distribucion {
  /** null cuando `totalSuprimido` es true: ver esa bandera. */
  total: number | null;
  /**
   * true cuando el total del grupo también se ocultó porque la única celda
   * suprimida por la regla base no tenía ninguna celda visible positiva con la
   * que aplicar la supresión complementaria (ver {@link aplicarSupresionComplementaria}):
   * en ese caso total − 0 − 0 − ... recupera exactamente el valor suprimido.
   */
  totalSuprimido: boolean;
  celdas: Record<NivelRiesgo, CeldaAgregado>;
}

/**
 * Celda de un agregado: suprime (n: null) cuando 0 < n < 3 (anti-reidentificación);
 * n = 0 se conserva (no reidentifica). Exportada para que otros módulos de armado
 * de vistas agregadas (p. ej. el informe 7.9) reutilicen el mismo criterio de
 * supresión en vez de reimplementarlo.
 */
export function celda(n: number, total: number): CeldaAgregado {
  if (n > 0 && n < 3) {
    return { n: null, porcentaje: null, suprimida: true };
  }
  return {
    n,
    porcentaje: total === 0 ? 0 : Math.round((n / total) * 100),
    suprimida: false,
  };
}

/**
 * Post-proceso de anti-reidentificación (regla inviolable 3, ampliada por decisión de
 * M6/tarea 2): la supresión por celda (0 < n < 3) no basta cuando el consumidor también
 * ve el TOTAL del grupo. Con exactamente UNA celda suprimida, su valor es recuperable
 * por resta (total − suma de celdas visibles = la celda suprimida). Contramedida
 * estándar de control de divulgación estadística: supresión complementaria — suprimir
 * también la celda visible NO suprimida de menor `n` positivo, para que la resta solo
 * revele la SUMA de dos celdas, no cada valor individual.
 *
 * - 0 celdas suprimidas o ≥2: nada que hacer (la resta ya no aísla un valor único).
 * - Exactamente 1 suprimida y existe alguna celda visible con n > 0: se suprime la de
 *   menor n (empate: la primera en el orden de {@link NIVELES}).
 * - Exactamente 1 suprimida y TODAS las demás están en 0: no hay celda complementaria
 *   que suprimir (suprimir una celda en 0 no cambiaría nada, sigue siendo 0 y seguiría
 *   revelando el valor por resta). En ese caso se oculta el TOTAL del grupo entero.
 */
function aplicarSupresionComplementaria(dist: Distribucion): Distribucion {
  const entradas = NIVELES.map((nivel) => [nivel, dist.celdas[nivel]] as const);
  const suprimidas = entradas.filter(([, c]) => c.suprimida);
  if (suprimidas.length !== 1) return dist;

  const visiblesPositivas = entradas.filter(([, c]) => !c.suprimida && (c.n ?? 0) > 0);
  if (visiblesPositivas.length === 0) {
    return { ...dist, total: null, totalSuprimido: true };
  }

  let [nivelMenor, celdaMenor] = visiblesPositivas[0];
  for (const [nivel, c] of visiblesPositivas) {
    if ((c.n as number) < (celdaMenor.n as number)) {
      nivelMenor = nivel;
      celdaMenor = c;
    }
  }

  return {
    ...dist,
    celdas: {
      ...dist.celdas,
      [nivelMenor]: { n: null, porcentaje: null, suprimida: true },
    },
  };
}

export function distribucionNiveles(niveles: readonly string[]): Distribucion {
  const conteos = new Map<string, number>();
  for (const nivel of niveles) {
    conteos.set(nivel, (conteos.get(nivel) ?? 0) + 1);
  }
  const total = niveles.length;
  const celdas = {} as Record<NivelRiesgo, CeldaAgregado>;
  for (const nivel of NIVELES) {
    celdas[nivel] = celda(conteos.get(nivel) ?? 0, total);
  }
  return aplicarSupresionComplementaria({ total, totalSuprimido: false, celdas });
}

/** Distribución por nombre de categoría o dominio, con supresión por celda. */
export function distribucionPorNombre(
  filas: readonly { nombre: string; nivel: string }[],
): Map<string, Distribucion> {
  const porNombre = new Map<string, string[]>();
  for (const fila of filas) {
    const lista = porNombre.get(fila.nombre) ?? [];
    lista.push(fila.nivel);
    porNombre.set(fila.nombre, lista);
  }
  const resultado = new Map<string, Distribucion>();
  for (const [nombre, niveles] of porNombre) {
    resultado.set(nombre, distribucionNiveles(niveles));
  }
  return resultado;
}
