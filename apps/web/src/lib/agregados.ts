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
   * true cuando la fila completa quedó enmascarada (ver {@link enmascararFilaCompleta}).
   * Va SIEMPRE junto con todas las celdas en `suprimida: true`: una fila enmascarada
   * no publica ni conteos, ni ceros, ni total.
   */
  totalSuprimido: boolean;
  celdas: Record<NivelRiesgo, CeldaAgregado>;
}

/**
 * Celda de un agregado: suprime (n: null) cuando 0 < n < 3 (anti-reidentificación);
 * n = 0 se conserva (no reidentifica). Exportada para que otros módulos de armado
 * de vistas agregadas (p. ej. el informe 7.7) reutilicen el mismo criterio de
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
 * Enmascarado de fila completa (regla inviolable 3, corregida tras la auditoría v0).
 *
 * La supresión por celda (0 < n < 3) oculta el CONTEO, pero no el ATRIBUTO: si las
 * demás celdas de la fila se publican en 0, el nivel de la única persona del grupo
 * queda al descubierto aunque su conteo esté enmascarado. Ejemplo real del defecto:
 *
 *   Nulo 0 (0%) · Bajo 0 (0%) · Medio [<3] · Alto 0 (0%) · Muy alto 0 (0%)
 *
 * Un rol patronal cruza esa fila con el padrón de empleados y el progreso por área y
 * deduce el nivel de riesgo psicosocial de una persona identificable — justo lo que
 * las reglas 3, 4 y 5 prohíben. Ocultar además el total (supresión complementaria de
 * M6) no protegía: los ceros ya revelaban que el resto de los niveles estaban vacíos.
 *
 * Regla vigente: si ALGUNA celda de la fila se suprime, se enmascara la FILA COMPLETA
 * — todas las celdas (incluidos los ceros) y el total. Así, el conjunto de celdas
 * publicadas de una fila enmascarada es vacío y no permite inferir nada de nadie.
 *
 * Casos deliberadamente NO enmascarados:
 * - total = 0 (nadie respondió): no hay ninguna persona sobre la que inferir.
 * - todas las celdas con n = 0 o n >= 3 (p. ej. 3/0/0/0/0): que las 3 personas del
 *   grupo estén en el mismo nivel es información sobre un grupo de 3, que es
 *   exactamente el umbral que la regla n < 3 acepta como no reidentificable.
 *
 * Limitación residual (documentada, abierta): el dashboard se recalcula en vivo, así
 * que un observador que lo consulte antes y después de cada respuesta puede inferir
 * por diferencia el nivel de quien acaba de responder. Cerrarlo exige publicar
 * instantáneas en vez de agregados en vivo (pendiente de producto).
 */
function enmascararFilaCompleta(dist: Distribucion): Distribucion {
  const hayCeldaSuprimida = NIVELES.some((nivel) => dist.celdas[nivel].suprimida);
  if (!hayCeldaSuprimida) return dist;

  const celdas = {} as Record<NivelRiesgo, CeldaAgregado>;
  for (const nivel of NIVELES) {
    celdas[nivel] = { n: null, porcentaje: null, suprimida: true };
  }
  return { total: null, totalSuprimido: true, celdas };
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
  return enmascararFilaCompleta({ total, totalSuprimido: false, celdas });
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
