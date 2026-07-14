'use client';

import Script from 'next/script';

/**
 * Widget de Cloudflare Turnstile en modo implícito: inyecta el input oculto
 * `cf-turnstile-response` en el <form> que lo contiene, así que las acciones que
 * reciben FormData lo llevan sin cableado extra. Sin NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * no se renderiza nada (desarrollo/E2E sin red externa); el servidor tampoco exige
 * el reto en ese caso (lib/turnstile.ts). El script externo hereda la confianza de
 * la CSP vía nonce + strict-dynamic; el iframe del reto requiere frame-src (middleware).
 */
export function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-language="es" />
    </>
  );
}

/** Lee el token emitido por el widget (para flujos que no envían FormData, p. ej. signUp). */
export function tokenTurnstile(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const input = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
  return input?.value || undefined;
}
