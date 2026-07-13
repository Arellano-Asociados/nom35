import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { plantillaCorreo, proveedorCorreo } from './correo';

// El proveedor Mailpit envía por el HTTP send API local (POST /api/v1/send) cuando
// MAILPIT_URL está definido y NO hay RESEND_API_KEY. Resend conserva precedencia
// (producción); sin ninguno, el proveedor nulo no hace nada y no truena.

const MENSAJE = {
  para: ['empleada@example.mx'],
  asunto: 'Tienes un cuestionario pendiente',
  html: '<p>Entra con tu enlace personal.</p>',
};

describe('proveedorCorreo', () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.MAILPIT_URL;
    delete process.env.MAIL_FROM;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it('con MAILPIT_URL (y sin Resend) envía por el send API de Mailpit', async () => {
    process.env.MAILPIT_URL = 'http://127.0.0.1:54324';
    process.env.MAIL_FROM = 'avisos@nom035.local';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    await proveedorCorreo().enviar(MENSAJE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:54324/api/v1/send');
    expect(init.method).toBe('POST');
    const cuerpo = JSON.parse(init.body as string);
    expect(cuerpo).toEqual({
      From: { Email: 'avisos@nom035.local' },
      To: [{ Email: 'empleada@example.mx' }],
      Subject: 'Tienes un cuestionario pendiente',
      HTML: '<p>Entra con tu enlace personal.</p>',
    });
  });

  it('lanza error si Mailpit responde con fallo (no silenciar en local)', async () => {
    process.env.MAILPIT_URL = 'http://127.0.0.1:54324';
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(proveedorCorreo().enviar(MENSAJE)).rejects.toThrow(/Mailpit/);
  });

  it('sin proveedor configurado no truena y no llama a la red', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(proveedorCorreo().enviar(MENSAJE)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con Resend (producción) exige MAIL_FROM: jamás sale un correo desde noreply@example.com', () => {
    process.env.RESEND_API_KEY = 're_llave_de_prueba';
    expect(() => proveedorCorreo()).toThrow(/MAIL_FROM/);
  });
});

describe('plantillaCorreo', () => {
  it('envuelve el cuerpo con la marca y un CTA táctil con la URL dada', () => {
    const html = plantillaCorreo({
      saludo: 'Hola Ana:',
      parrafos: ['Te invitamos a responder tu cuestionario.'],
      cta: { url: 'https://constata.mx/responder/abc', etiqueta: 'Responder cuestionario' },
    });
    expect(html).toContain('Constata');
    expect(html).toContain('https://constata.mx/responder/abc');
    expect(html).toContain('Responder cuestionario');
    expect(html).toContain('Hola Ana:');
  });

  it('escapa el HTML de los textos interpolados (nombre desde un CSV manipulado)', () => {
    const html = plantillaCorreo({
      saludo: 'Hola <img src=x onerror=alert(1)>:',
      parrafos: ['a & b <script>'],
    });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img');
    expect(html).toContain('a &amp; b');
  });
});
