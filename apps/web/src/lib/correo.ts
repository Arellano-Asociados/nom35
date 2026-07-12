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
  const remitente = process.env.MAIL_FROM ?? 'noreply@example.com';
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    return new ProveedorResend(new Resend(apiKey), remitente);
  }
  const mailpitUrl = process.env.MAILPIT_URL;
  if (mailpitUrl) {
    return new ProveedorMailpit(mailpitUrl, remitente);
  }
  return new ProveedorNulo();
}
