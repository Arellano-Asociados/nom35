import { Resend } from 'resend';

// Correo transaccional detrás de una interfaz (regla del stack): Resend si hay API key
// (producción); Mailpit si hay MAILPIT_URL (desarrollo local: el Supabase local ya trae
// Mailpit en http://127.0.0.1:54324 — atrapa TODO el correo saliente en una bandeja web,
// nada se envía de verdad); proveedor nulo si no hay ninguno. PROHIBIDO incluir respuestas
// o resultados en los correos (regla inviolable 9): solo avisos genéricos con enlace a la
// plataforma.

export interface MensajeCorreo {
  para: readonly string[];
  asunto: string;
  html: string;
}

export interface MailProvider {
  enviar(mensaje: MensajeCorreo): Promise<void>;
}

class ProveedorResend implements MailProvider {
  constructor(
    private readonly resend: Resend,
    private readonly remitente: string,
  ) {}

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    await this.resend.emails.send({
      from: this.remitente,
      to: [...mensaje.para],
      subject: mensaje.asunto,
      html: mensaje.html,
    });
  }
}

/** Bandeja local de desarrollo: envía por el HTTP send API de Mailpit (v1.12+). */
class ProveedorMailpit implements MailProvider {
  constructor(
    private readonly urlBase: string,
    private readonly remitente: string,
  ) {}

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    const respuesta = await fetch(`${this.urlBase.replace(/\/$/, '')}/api/v1/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: { Email: this.remitente },
        To: mensaje.para.map((email) => ({ Email: email })),
        Subject: mensaje.asunto,
        HTML: mensaje.html,
      }),
    });
    if (!respuesta.ok) {
      // En local un fallo de la bandeja debe verse, no silenciarse.
      throw new Error(`Mailpit respondió ${respuesta.status} al enviar el correo`);
    }
  }
}

class ProveedorNulo implements MailProvider {
  async enviar(): Promise<void> {
    // Sin proveedor configurado no se envía nada (desarrollo/pruebas)
  }
}

export function proveedorCorreo(): MailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    // En producción el remitente es obligatorio: el fallback anterior
    // (noreply@example.com) era indistinguible de phishing y destino directo a
    // spam (auditoría v0, C-09). Mejor fallar ruidoso al arrancar el envío.
    const remitente = process.env.MAIL_FROM;
    if (!remitente) {
      throw new Error(
        'MAIL_FROM es obligatorio cuando RESEND_API_KEY está configurada (p. ej. "Constata <avisos@dominio.mx>").',
      );
    }
    return new ProveedorResend(new Resend(apiKey), remitente);
  }
  const mailpitUrl = process.env.MAILPIT_URL;
  if (mailpitUrl) {
    return new ProveedorMailpit(mailpitUrl, process.env.MAIL_FROM ?? 'constata@localhost');
  }
  return new ProveedorNulo();
}

// ─── Plantilla de marca ──────────────────────────────────────────────────────

export function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Plantilla única de correo con la marca Constata (docs/BRAND.md §6): wordmark,
 * botón CTA táctil y pie con la promesa de confidencialidad. TODOS los textos se
 * escapan aquí (el nombre del empleado viene de un CSV importable: inyección de
 * HTML, hallazgo Bajo de la auditoría v0). Estilos en línea: es correo.
 */
export function plantillaCorreo({
  saludo,
  parrafos,
  cta,
}: {
  saludo: string;
  parrafos: readonly string[];
  cta?: { url: string; etiqueta: string };
}): string {
  const cuerpo = parrafos
    .map(
      (p) =>
        `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#334155;">${escaparHtml(p)}</p>`,
    )
    .join('');
  const boton = cta
    ? `<p style="margin:20px 0;">
         <a href="${escaparHtml(cta.url)}"
            style="display:inline-block;min-height:44px;padding:12px 24px;border-radius:8px;background:#2b4193;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
           ${escaparHtml(cta.etiqueta)}
         </a>
       </p>`
    : '';
  return `<!doctype html>
<html lang="es-MX">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
      <p style="margin:0 0 20px;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#2b4193;">Constata</p>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0f172a;font-weight:600;">${escaparHtml(saludo)}</p>
        ${cuerpo}
        ${boton}
      </div>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#64748b;">
        Constata — cumplimiento NOM-035-STPS-2018. Este correo nunca incluye tus respuestas ni tus resultados.
      </p>
    </div>
  </body>
</html>`;
}
