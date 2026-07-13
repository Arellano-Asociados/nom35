import { describe, expect, it } from 'vitest';
import { fechaEsMx } from './fechas';

describe('fechaEsMx', () => {
  it('formatea una fecha civil ISO en es-MX', () => {
    expect(fechaEsMx('2026-07-12')).toBe('12 de julio de 2026');
  });

  it('no corre el día por huso horario (fecha civil anclada a mediodía UTC)', () => {
    expect(fechaEsMx('2026-01-01')).toBe('1 de enero de 2026');
    expect(fechaEsMx('2026-12-31')).toBe('31 de diciembre de 2026');
  });

  it('tolera timestamps completos usando solo la parte de fecha', () => {
    expect(fechaEsMx('2026-07-12T23:59:59.000Z')).toBe('12 de julio de 2026');
  });

  it('devuelve un guion largo para null/undefined y el valor crudo si no parsea', () => {
    expect(fechaEsMx(null)).toBe('—');
    expect(fechaEsMx(undefined)).toBe('—');
    expect(fechaEsMx('no-es-fecha')).toBe('no-es-fecha');
  });
});
