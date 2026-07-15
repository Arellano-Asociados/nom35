// Lógica pura de la frescura MFA de /admin (spec §1.4–§1.5). Separada de
// autorizacion-plataforma.ts para poder probarla sin next/navigation ni cookies.

/**
 * Sesión efectiva de /admin: frescura de la última verificación TOTP leída del AMR.
 * 4 horas — el operador comprometido es la amenaza nº 1; el costo es teclear un TOTP dos
 * veces por jornada. Constante EN CÓDIGO, no en env: que no sea "configurable hacia
 * arriba" en silencio.
 */
export const VENTANA_TOTP_ADMIN_MS = 4 * 60 * 60 * 1000;

export type PasoMfaAdmin = 'enrolar' | 'verificar' | 'ok';

export interface EstadoAal {
  currentLevel: string | null;
  nextLevel: string | null;
  /** AMR de GoTrue: timestamp en SEGUNDOS unix. El tipo upstream admite string[] (sin
   * timestamp); ese caso degenera fail-closed a re-verificar. */
  currentAuthenticationMethods: ({ method: string; timestamp: number } | string)[];
}

/**
 * A diferencia del panel (que degrada a aal1 si no hay factor), aquí "no tiene factor"
 * BLOQUEA en el enrolamiento: no hay camino a una página de /admin sin aal2 fresco.
 */
export function pasoMfaAdmin(aal: EstadoAal, ahoraMs: number): PasoMfaAdmin {
  if (aal.nextLevel === 'aal1') return 'enrolar';
  if (aal.currentLevel !== 'aal2') return 'verificar';
  const totp = aal.currentAuthenticationMethods.find(
    (m): m is { method: string; timestamp: number } => typeof m !== 'string' && m.method === 'totp',
  );
  if (!totp || ahoraMs - totp.timestamp * 1000 > VENTANA_TOTP_ADMIN_MS) return 'verificar';
  return 'ok';
}
