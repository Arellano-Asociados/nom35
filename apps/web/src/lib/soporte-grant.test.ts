import { describe, expect, it } from 'vitest';
import { evaluarGrantSoporte, type GrantSoporte } from './soporte-grant';

// Núcleo puro de autorizarSoporte() (spec §6.4, decisión 5a): el grant es NOMINATIVO.
// Un grant del operador A no abre NADA al operador B (amenaza 15). La evaluación ocurre
// ANTES de registrar el evento de vista: un rechazo aquí implica que NO se escribe
// ningún evento en la bitácora del tenant (el orden lo garantiza autorizarSoporte).

const AHORA = 1_800_000_000_000;
const OP_A = 'operador-a';
const OP_B = 'operador-b';

function grant(overrides: Partial<GrantSoporte>): GrantSoporte {
  return {
    id: 'grant-1',
    operator_user_id: OP_A,
    expires_at: new Date(AHORA + 60 * 60 * 1000).toISOString(),
    revoked_at: null,
    ...overrides,
  };
}

describe('evaluarGrantSoporte', () => {
  it('grant vigente del propio operador: autorizado', () => {
    expect(evaluarGrantSoporte([grant({})], OP_A, AHORA)?.id).toBe('grant-1');
  });

  it('amenaza 15: grant otorgado al operador A NO abre nada al operador B', () => {
    expect(evaluarGrantSoporte([grant({})], OP_B, AHORA)).toBeNull();
  });

  it('amenaza 8: grant expirado → rechazado', () => {
    expect(
      evaluarGrantSoporte(
        [grant({ expires_at: new Date(AHORA - 1000).toISOString() })],
        OP_A,
        AHORA,
      ),
    ).toBeNull();
  });

  it('amenaza 8: grant revocado → rechazado aunque no haya expirado', () => {
    expect(
      evaluarGrantSoporte(
        [grant({ revoked_at: new Date(AHORA - 1000).toISOString() })],
        OP_A,
        AHORA,
      ),
    ).toBeNull();
  });

  it('sin grants: rechazado (sin grant vigente el operador no ve NADA)', () => {
    expect(evaluarGrantSoporte([], OP_A, AHORA)).toBeNull();
  });

  it('entre varios grants, solo autoriza el vigente Y nominativo del operador', () => {
    const grants = [
      grant({ id: 'de-otro', operator_user_id: OP_B }),
      grant({ id: 'revocado', revoked_at: new Date(AHORA).toISOString() }),
      grant({ id: 'vigente-propio' }),
    ];
    expect(evaluarGrantSoporte(grants, OP_A, AHORA)?.id).toBe('vigente-propio');
  });
});
