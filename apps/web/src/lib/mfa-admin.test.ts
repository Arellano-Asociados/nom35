import { describe, expect, it } from 'vitest';
import { pasoMfaAdmin, VENTANA_TOTP_ADMIN_MS } from './mfa-admin';

// La "sesión corta" de /admin es frescura de la última verificación TOTP leída del AMR
// (spec §1.4–§1.5): sin factor → enrolamiento FORZADO (no hay degradación a aal1 como en
// el panel); factor sin verificar → verificar; TOTP más viejo que la ventana → re-verificar.

const AHORA = 1_800_000_000_000; // ms

function aal(overrides: {
  currentLevel?: string | null;
  nextLevel?: string | null;
  metodos?: { method: string; timestamp: number }[];
}) {
  return {
    currentLevel: overrides.currentLevel ?? 'aal2',
    nextLevel: overrides.nextLevel ?? 'aal2',
    currentAuthenticationMethods: overrides.metodos ?? [
      { method: 'password', timestamp: AHORA / 1000 - 60 },
      { method: 'totp', timestamp: AHORA / 1000 - 60 },
    ],
  };
}

describe('pasoMfaAdmin', () => {
  it('sin factor TOTP (nextLevel aal1): enrolamiento forzado, sin camino a /admin', () => {
    expect(pasoMfaAdmin(aal({ currentLevel: 'aal1', nextLevel: 'aal1', metodos: [] }), AHORA)).toBe(
      'enrolar',
    );
  });

  it('factor existente sin verificar en esta sesión (aal1 → aal2): verificar', () => {
    expect(
      pasoMfaAdmin(
        aal({
          currentLevel: 'aal1',
          nextLevel: 'aal2',
          metodos: [{ method: 'password', timestamp: AHORA / 1000 - 60 }],
        }),
        AHORA,
      ),
    ).toBe('verificar');
  });

  it('aal2 con TOTP fresco: ok', () => {
    expect(pasoMfaAdmin(aal({}), AHORA)).toBe('ok');
  });

  it('aal2 pero el TOTP del AMR es más viejo que la ventana de 4h: re-verificar', () => {
    const viejo = (AHORA - VENTANA_TOTP_ADMIN_MS - 1000) / 1000;
    expect(
      pasoMfaAdmin(
        aal({
          metodos: [
            { method: 'password', timestamp: viejo },
            { method: 'totp', timestamp: viejo },
          ],
        }),
        AHORA,
      ),
    ).toBe('verificar');
  });

  it('exactamente en el borde de la ventana sigue vigente; un ms después ya no', () => {
    const enBorde = (AHORA - VENTANA_TOTP_ADMIN_MS) / 1000;
    expect(pasoMfaAdmin(aal({ metodos: [{ method: 'totp', timestamp: enBorde }] }), AHORA)).toBe(
      'ok',
    );
  });

  it('aal2 sin método totp en el AMR (estado anómalo): fail-closed a verificar', () => {
    expect(
      pasoMfaAdmin(aal({ metodos: [{ method: 'password', timestamp: AHORA / 1000 }] }), AHORA),
    ).toBe('verificar');
  });

  it('AMR con métodos como string (sin timestamp, tipo upstream): fail-closed a verificar', () => {
    expect(
      pasoMfaAdmin(
        {
          currentLevel: 'aal2',
          nextLevel: 'aal2',
          currentAuthenticationMethods: ['password', 'totp'],
        },
        AHORA,
      ),
    ).toBe('verificar');
  });

  it('la ventana es 4 horas exactas (constante en código, no configurable por env)', () => {
    expect(VENTANA_TOTP_ADMIN_MS).toBe(4 * 60 * 60 * 1000);
  });
});
