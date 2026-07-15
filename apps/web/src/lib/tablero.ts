// Lógica pura del dashboard ejecutivo (spec §1). Sin I/O: la página consulta y le pasa
// los datos. Las fechas se comparan como strings ISO 'YYYY-MM-DD' (orden lexicográfico =
// orden cronológico) para no depender de zonas horarias del runtime.

export interface CicloTablero {
  id: string;
  dateStart: string; // 'YYYY-MM-DD'
  dateEnd: string | null;
}

/**
 * El ciclo "activo": el de `date_start` más reciente cuyo `date_end` es null o futuro
 * (aún no cerró). Null si todos cerraron o no hay ciclos. El dashboard ejecutivo se
 * centra en este ciclo.
 */
export function cicloActivoDe(ciclos: readonly CicloTablero[], hoy: string): CicloTablero | null {
  const abiertos = ciclos.filter((c) => c.dateEnd === null || c.dateEnd >= hoy);
  if (abiertos.length === 0) return null;
  return abiertos.reduce((mejor, c) => (c.dateStart > mejor.dateStart ? c : mejor));
}

export type EstadoVencimiento = 'vencido' | 'proximo' | 'al_corriente';

const DIAS_PROXIMO = 30;

/**
 * Clasifica una fecha compromiso: vencida (hoy o antes), próxima (≤30 días) o al
 * corriente. Sin fecha → al corriente (no hay vencimiento que vigilar).
 */
export function clasificarVencimiento(dueDate: string | null, hoy: string): EstadoVencimiento {
  if (!dueDate) return 'al_corriente';
  if (dueDate <= hoy) return 'vencido';
  const limite = new Date(`${hoy}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + DIAS_PROXIMO);
  const limiteIso = limite.toISOString().slice(0, 10);
  return dueDate <= limiteIso ? 'proximo' : 'al_corriente';
}

/**
 * ¿Mostrar el dashboard ejecutivo o el checklist de onboarding? Tablero cuando ya hay
 * operación real (≥1 ciclo con asignaciones distribuidas); si no, el checklist guía el
 * arranque.
 */
export function mostrarTablero({
  ciclos,
  asignaciones,
}: {
  ciclos: number;
  asignaciones: number;
}): boolean {
  return ciclos > 0 && asignaciones > 0;
}
