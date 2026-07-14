import { describe, expect, it } from 'vitest';
import { debeRecordar } from './recordatorios';

describe('debeRecordar (recordatorios automáticos, Fase 3)', () => {
  const AHORA = '2026-07-13T12:00:00.000Z';

  it('sin intervalo configurado, nunca', () => {
    expect(debeRecordar({ intervaloDias: null, ultimoEnvio: null, ahora: AHORA })).toBe(false);
  });

  it('con intervalo y sin envíos previos, sí (arranca el ciclo de recordatorios)', () => {
    expect(debeRecordar({ intervaloDias: 7, ultimoEnvio: null, ahora: AHORA })).toBe(true);
  });

  it('respeta el intervalo: no antes de N días, sí a partir de N', () => {
    expect(
      debeRecordar({ intervaloDias: 7, ultimoEnvio: '2026-07-08T12:00:00.000Z', ahora: AHORA }),
    ).toBe(false);
    expect(
      debeRecordar({ intervaloDias: 7, ultimoEnvio: '2026-07-06T11:00:00.000Z', ahora: AHORA }),
    ).toBe(true);
  });
});
