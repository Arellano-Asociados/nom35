import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
vi.mock('./supabase-admin', () => ({
  clienteAdmin: () => ({ rpc: rpcMock }),
}));

import { permitido } from './limites';

describe('permitido (limitador de tasa)', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('llama a la RPC con la clave y los parámetros de la ventana', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    const r = await permitido('arco:1.2.3.4', { ventanaSegundos: 3600, maximo: 5 });
    expect(r).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('golpe_limite', {
      p_clave: 'arco:1.2.3.4',
      p_ventana_segundos: 3600,
      p_maximo: 5,
    });
  });

  it('devuelve false cuando el límite se excede', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });
    expect(await permitido('token:1.2.3.4', { ventanaSegundos: 600, maximo: 20 })).toBe(false);
  });

  it('fail-open: si el limitador falla, la operación se permite (y se reporta)', async () => {
    // Un limitador caído no debe tirar el producto; la disponibilidad gana y el
    // error queda en el log del servidor (nunca datos del usuario).
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await permitido('arco:1.2.3.4', { ventanaSegundos: 3600, maximo: 5 })).toBe(true);
  });
});
