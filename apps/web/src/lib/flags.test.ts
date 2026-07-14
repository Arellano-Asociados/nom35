import { beforeEach, describe, expect, it, vi } from 'vitest';

const maybeSingleMock = vi.fn();
vi.mock('./supabase-servidor', () => ({
  clienteSesion: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      }),
    }),
  }),
}));

import { FLAGS, flagActiva } from './flags';

describe('flagActiva', () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
  });

  it('devuelve el valor de la fila cuando existe', async () => {
    maybeSingleMock.mockResolvedValue({ data: { enabled: false }, error: null });
    expect(await flagActiva('empresa-1', FLAGS.cuestionariosPersonalizados, true)).toBe(false);
  });

  it('sin fila aplica el default del código', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    expect(await flagActiva('empresa-1', FLAGS.cuestionariosPersonalizados, true)).toBe(true);
    expect(await flagActiva('empresa-1', 'otro_flag', false)).toBe(false);
  });

  it('ante un error de lectura aplica el default (nunca truena la página)', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await flagActiva('empresa-1', 'x', true)).toBe(true);
  });
});
