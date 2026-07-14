/**
 * Anti-bot con Cloudflare Turnstile (Fase 2.5; elegido por no depender de cookies de
 * rastreo ni de terceros invasivos: reto no interactivo, gratuito y con llaves de
 * prueba oficiales para desarrollo). Sin TURNSTILE_SECRET_KEY el reto NO se exige:
 * desarrollo local y E2E corren sin red externa; en producción la llave es parte
 * del despliegue (.env.example).
 *
 * FAIL-OPEN ante caída de siteverify: la disponibilidad del canal ARCO (obligación
 * legal) y del registro pesa más que el filtrado de bots; el rate limiting de BD
 * sigue activo por debajo.
 */
export async function verificarTurnstile(
  token: string,
  ip: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secreto = process.env.TURNSTILE_SECRET_KEY;
  if (!secreto) return { ok: true };

  try {
    const respuesta = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secreto, response: token, remoteip: ip }),
    });
    const datos = (await respuesta.json()) as { success?: boolean };
    if (datos.success === true) return { ok: true };
    return {
      ok: false,
      error: 'No pudimos verificar que eres una persona. Recarga la página e intenta de nuevo.',
    };
  } catch {
    return { ok: true };
  }
}
