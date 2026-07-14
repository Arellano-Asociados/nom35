import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verificarTurnstile } from './turnstile';

describe('verificarTurnstile', () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it('sin TURNSTILE_SECRET_KEY no exige el reto (desarrollo/E2E): pasa sin red', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    expect(await verificarTurnstile('', '1.2.3.4')).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con llave, verifica contra siteverify y acepta success:true', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreto';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(await verificarTurnstile('token-widget', '1.2.3.4')).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('challenges.cloudflare.com/turnstile');
    const cuerpo = JSON.parse(init.body as string);
    expect(cuerpo).toEqual({ secret: 'secreto', response: 'token-widget', remoteip: '1.2.3.4' });
  });

  it('con llave y success:false, rechaza con mensaje accionable', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreto';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    }) as unknown as typeof fetch;

    const r = await verificarTurnstile('token-malo', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Recarga la página');
  });

  it('fail-open si siteverify no responde (disponibilidad ante caída del tercero)', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreto';
    global.fetch = vi.fn().mockRejectedValue(new Error('red caída')) as unknown as typeof fetch;
    expect(await verificarTurnstile('token', '1.2.3.4')).toEqual({ ok: true });
  });
});
