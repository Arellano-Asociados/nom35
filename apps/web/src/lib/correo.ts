import { Resend } from 'resend';

// Correo transaccional detrás de una interfaz (regla del stack): Resend si hay API key,
// proveedor nulo en desarrollo/pruebas. PROHIBIDO incluir respuestas o resultados en los
// correos (regla inviolable 9): solo avisos genéricos con enlace a la plataforma.

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

class ProveedorNulo implements MailProvider {
  async enviar(): Promise<void> {
    // Sin proveedor configurado no se envía nada (desarrollo/pruebas)
  }
}

export function proveedorCorreo(): MailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    return new ProveedorResend(new Resend(apiKey), process.env.MAIL_FROM ?? 'noreply@example.com');
  }
  return new ProveedorNulo();
}
