import { describe, expect, it, vi } from 'vitest';

// Variante estricta (regla inviolable 5): el caller depende del booleano para decidir si
// muestra o no un resultado individual sensible, así que su mapeo error->false / éxito->true
// merece prueba propia aunque el resto del helper sea un envoltorio delgado de Supabase.

const insertMock = vi.fn();

vi.mock('./supabase-admin', () => ({
  clienteAdmin: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

describe('registrarAuditoriaEstricta', () => {
  it('devuelve true cuando el INSERT en audit_log no reporta error', async () => {
    insertMock.mockResolvedValueOnce({ error: null });
    const { registrarAuditoriaEstricta } = await import('./auditoria');

    const ok = await registrarAuditoriaEstricta(
      'empresa-1',
      'usuario-1',
      'individual_result_access',
      'risk_results',
      'resultado-1',
      { employee_id: 'empleado-1', cycle_id: 'ciclo-1' },
    );

    expect(ok).toBe(true);
    expect(insertMock).toHaveBeenCalledWith({
      company_id: 'empresa-1',
      actor_user_id: 'usuario-1',
      event_type: 'individual_result_access',
      entity: 'risk_results',
      entity_id: 'resultado-1',
      details: { employee_id: 'empleado-1', cycle_id: 'ciclo-1' },
    });
  });

  it('devuelve false (sin lanzar) cuando el INSERT falla', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'boom' } });
    const { registrarAuditoriaEstricta } = await import('./auditoria');

    const ok = await registrarAuditoriaEstricta(
      'empresa-1',
      'usuario-1',
      'individual_result_access',
    );

    expect(ok).toBe(false);
  });
});
