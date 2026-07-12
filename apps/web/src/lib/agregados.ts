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
  total: number;
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
  return { total, celdas };
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
