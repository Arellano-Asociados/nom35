import { describe, expect, it } from 'vitest';
import { cicloActivoDe, clasificarVencimiento, mostrarTablero, type CicloTablero } from './tablero';

// Lógica pura del dashboard ejecutivo (spec §1): elegir el ciclo activo, clasificar
// vencimientos y decidir checklist vs tablero. Sin I/O — la página le pasa los datos.

const HOY = '2026-07-14';

describe('cicloActivoDe', () => {
  const ciclos: CicloTablero[] = [
    { id: 'viejo', dateStart: '2024-01-10', dateEnd: '2024-02-10' },
    { id: 'medio', dateStart: '2026-01-10', dateEnd: '2026-03-10' }, // ya cerrado
    { id: 'abierto', dateStart: '2026-06-01', dateEnd: null }, // sin cierre
  ];

  it('el ciclo activo es el más reciente sin date_end pasado', () => {
    expect(cicloActivoDe(ciclos, HOY)?.id).toBe('abierto');
  });

  it('entre varios abiertos, el de date_start más reciente', () => {
    const dos: CicloTablero[] = [
      { id: 'a', dateStart: '2026-02-01', dateEnd: null },
      { id: 'b', dateStart: '2026-05-01', dateEnd: null },
    ];
    expect(cicloActivoDe(dos, HOY)?.id).toBe('b');
  });

  it('un ciclo con date_end futuro sigue activo', () => {
    const futuro: CicloTablero[] = [{ id: 'f', dateStart: '2026-07-01', dateEnd: '2026-08-30' }];
    expect(cicloActivoDe(futuro, HOY)?.id).toBe('f');
  });

  it('si todos cerraron, no hay ciclo activo', () => {
    const cerrados: CicloTablero[] = [{ id: 'x', dateStart: '2024-01-01', dateEnd: '2024-02-01' }];
    expect(cicloActivoDe(cerrados, HOY)).toBeNull();
  });

  it('sin ciclos, null', () => {
    expect(cicloActivoDe([], HOY)).toBeNull();
  });
});

describe('clasificarVencimiento', () => {
  it('fecha pasada → vencido', () => {
    expect(clasificarVencimiento('2026-07-13', HOY)).toBe('vencido');
  });

  it('hoy mismo → vencido (el plazo ya llegó)', () => {
    expect(clasificarVencimiento('2026-07-14', HOY)).toBe('vencido');
  });

  it('dentro de 30 días → próximo', () => {
    expect(clasificarVencimiento('2026-08-10', HOY)).toBe('proximo');
  });

  it('exactamente 30 días → próximo', () => {
    expect(clasificarVencimiento('2026-08-13', HOY)).toBe('proximo');
  });

  it('a más de 30 días → al corriente', () => {
    expect(clasificarVencimiento('2026-09-30', HOY)).toBe('al_corriente');
  });

  it('sin fecha compromiso → al corriente (no es un vencimiento)', () => {
    expect(clasificarVencimiento(null, HOY)).toBe('al_corriente');
  });
});

describe('mostrarTablero', () => {
  it('con al menos un ciclo con asignaciones: tablero', () => {
    expect(mostrarTablero({ ciclos: 1, asignaciones: 6 })).toBe(true);
  });

  it('con ciclos pero cero asignaciones (aún no distribuye): checklist', () => {
    expect(mostrarTablero({ ciclos: 2, asignaciones: 0 })).toBe(false);
  });

  it('sin ciclos: checklist', () => {
    expect(mostrarTablero({ ciclos: 0, asignaciones: 0 })).toBe(false);
  });
});
