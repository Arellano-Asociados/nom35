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
   * true cuando el total del grupo también se ocultó porque las celdas suprimidas
   * por la regla base no tenían ninguna celda visible positiva con la que aplicar
   * la supresión complementaria (ver {@link aplicarSupresionComplementaria}): en
   * ese caso total − (suma de celdas visibles, todas en 0) recupera exactamente la
   * suma forzada de las celdas suprimidas, y esa suma tiene una única
   * descomposición posible sobre sus valores.
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
 * ve el TOTAL del grupo. Toda celda suprimida por la regla base tiene un valor
 * original n ∈ {1, 2} (es el único rango que dispara `celda()`). Si hay k celdas
 * suprimidas y su suma forzada S = total − (suma de las celdas visibles) tiene una
 * ÚNICA descomposición posible sobre k valores ∈ {1, 2}, esa descomposición revela
 * cada valor individual aunque haya más de una celda suprimida. La descomposición es
 * única exactamente cuando S = k (todas valen 1) o S = 2k (todas valen 2); con k = 1
 * ambos casos son el mismo (S ∈ {1, 2}), así que k === 1 siempre necesita protección.
 *
 * Nota de equivalencia: S también es, por construcción, la suma de los valores
 * ORIGINALES de las celdas suprimidas (aunque `celda()` ya les puso `n: null` antes
 * de llegar aquí): total = suma de TODOS los valores originales = suma(suprimidas) +
 * suma(visibles), así que suma(suprimidas) = total − suma(visibles) = S. No hace
 * falta guardar los valores originales aparte para calcular S.
 *
 * - 0 celdas suprimidas: nada que hacer (no hay nada que proteger).
 * - k ≥ 1 con descomposición única (k === 1, o S === k, o S === 2k) y existe alguna
 *   celda visible con n > 0: se suprime también la de menor n (empate: la primera en
 *   el orden de {@link NIVELES}). Aunque la celda recién suprimida tiene n ≥ 3
 *   (rango distinto al {1,2} de las suprimidas por la regla base), un atacante no
 *   puede asignar de forma única los valores a las celdas ETIQUETADAS: intercambiar
 *   cuál celda etiquetada tenía el valor ≥3 produce una salida indistinguible bajo
 *   este mismo algoritmo, así que la ambigüedad de etiquetado es la protección.
 * - k ≥ 1 con descomposición única y TODAS las demás celdas están en 0: no hay celda
 *   complementaria positiva que suprimir (suprimir una celda en 0 no cambiaría nada,
 *   sigue siendo 0 y seguiría revelando la suma forzada). En ese caso se oculta el
 *   TOTAL del grupo entero.
 * - k ≥ 2 sin descomposición única (p. ej. S = 3, k = 2: 3 ≠ 2 y 3 ≠ 4): nada que
 *   hacer, la resta solo revela la SUMA de las suprimidas, no cada valor.
 *
 * Limitación residual (documentada, no resuelta por esta tarea): esto protege ESTA
 * tabla, pero un total oculto (`totalSuprimido`) puede seguir siendo inferible
 * cruzando otras cifras publicadas (p. ej. el conteo de participación suele coincidir
 * con el total de la distribución global de ese mismo ciclo). El control de
 * divulgación estadística contra inferencia cruzada entre tablas ligadas es una
 * decisión de producto documentada, pendiente para un milestone futuro.
 */
function aplicarSupresionComplementaria(dist: Distribucion): Distribucion {
  const entradas = NIVELES.map((nivel) => [nivel, dist.celdas[nivel]] as const);
  const suprimidas = entradas.filter(([, c]) => c.suprimida);
  const k = suprimidas.length;
  if (k === 0) return dist;

  const total = dist.total ?? 0;
  const sumaVisibles = entradas.reduce((acc, [, c]) => acc + (c.suprimida ? 0 : (c.n ?? 0)), 0);
  const S = total - sumaVisibles;
  const descomposicionUnica = k === 1 || S === k || S === 2 * k;
  if (!descomposicionUnica) return dist;

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
