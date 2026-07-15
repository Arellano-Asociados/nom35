// Lógica pura del ciclo de vida de operadores de plataforma (spec §1.1–§1.2).
// invited → active (contraseña + TOTP verificado) · active|invited → disabled (baja;
// nunca DELETE: invited_by y la bitácora lo referencian). No hay retorno de disabled.

export type EstadoOperador = 'invited' | 'active' | 'disabled';

const TRANSICIONES: Record<EstadoOperador, EstadoOperador[]> = {
  invited: ['active', 'disabled'],
  active: ['disabled'],
  disabled: [],
};

export function transicionOperadorValida(de: EstadoOperador, a: EstadoOperador): boolean {
  return TRANSICIONES[de].includes(a);
}

export type ResultadoValidacion = { ok: true } | { ok: false; error: string };

/** La plataforma no puede quedarse sin operación: el último activo no se deshabilita. */
export function puedeDeshabilitarOperador(
  operadores: { id: string; status: EstadoOperador }[],
  objetivoId: string,
): ResultadoValidacion {
  const objetivo = operadores.find((o) => o.id === objetivoId);
  if (!objetivo) return { ok: false, error: 'El operador no existe.' };
  if (!transicionOperadorValida(objetivo.status, 'disabled')) {
    return { ok: false, error: 'El operador ya está deshabilitado.' };
  }
  const activos = operadores.filter((o) => o.status === 'active').length;
  if (objetivo.status === 'active' && activos <= 1) {
    return { ok: false, error: 'No puedes deshabilitar al último operador activo.' };
  }
  return { ok: true };
}
