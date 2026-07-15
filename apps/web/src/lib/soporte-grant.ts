// Núcleo PURO de autorizarSoporte (spec §6.4): separado para probarse sin next/cookies.

export interface GrantSoporte {
  id: string;
  operator_user_id: string;
  expires_at: string;
  revoked_at: string | null;
}

/**
 * Devuelve el grant que autoriza al operador de la sesión, o null. Decisión 5a: el
 * operator_user_id del grant debe ser EXACTAMENTE el platform_users.id de la sesión —
 * un grant del operador A no abre nada al operador B (amenaza 15).
 */
export function evaluarGrantSoporte(
  grants: GrantSoporte[],
  operadorId: string,
  ahoraMs: number,
): GrantSoporte | null {
  return (
    grants.find(
      (g) =>
        g.operator_user_id === operadorId &&
        g.revoked_at === null &&
        new Date(g.expires_at).getTime() > ahoraMs,
    ) ?? null
  );
}
