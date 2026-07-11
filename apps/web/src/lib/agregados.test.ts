import { describe, expect, it } from 'vitest';
import { distribucionNiveles, distribucionPorNombre } from './agregados';

// Reglas inviolables 2 y 3: agregados = distribuciones y conteos (JAMÁS promedios);
// toda celda con 0 < n < 3 se suprime (anti-reidentificación).

describe('distribucionNiveles', () => {
  it('cuenta y calcula porcentajes por nivel', () => {
    const niveles = [
      'nulo',
      'nulo',
      'nulo',
      'alto',
      'alto',
      'alto',
      'alto',
      'medio',
      'medio',
      'medio',
    ];
    const d = distribucionNiveles(niveles);
    expect(d.total).toBe(10);
    expect(d.celdas.nulo).toEqual({ n: 3, porcentaje: 30, suprimida: false });
    expect(d.celdas.alto).toEqual({ n: 4, porcentaje: 40, suprimida: false });
    expect(d.celdas.medio).toEqual({ n: 3, porcentaje: 30, suprimida: false });
  });

  it('suprime celdas con 0 < n < 3 (sin conteo ni porcentaje)', () => {
    const d = distribucionNiveles(['bajo', 'bajo', 'muy_alto', 'nulo', 'nulo', 'nulo']);
    expect(d.celdas.bajo).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(d.celdas.muy_alto).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(d.celdas.nulo.n).toBe(3);
  });

  it('celdas con n = 0 no se suprimen (cero no reidentifica)', () => {
    const d = distribucionNiveles(['nulo', 'nulo', 'nulo']);
    expect(d.celdas.alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
  });

  it('lista vacía produce total 0', () => {
    const d = distribucionNiveles([]);
    expect(d.total).toBe(0);
    expect(d.celdas.nulo.n).toBe(0);
  });
});

describe('distribucionPorNombre', () => {
  it('agrupa por nombre (categoría o dominio) aplicando la supresión por celda', () => {
    const filas = [
      { nombre: 'Carga de trabajo', nivel: 'alto' },
      { nombre: 'Carga de trabajo', nivel: 'alto' },
      { nombre: 'Carga de trabajo', nivel: 'alto' },
      { nombre: 'Carga de trabajo', nivel: 'nulo' },
      { nombre: 'Violencia', nivel: 'nulo' },
      { nombre: 'Violencia', nivel: 'nulo' },
      { nombre: 'Violencia', nivel: 'nulo' },
    ];
    const porNombre = distribucionPorNombre(filas);
    const carga = porNombre.get('Carga de trabajo');
    expect(carga?.total).toBe(4);
    expect(carga?.celdas.alto).toEqual({ n: 3, porcentaje: 75, suprimida: false });
    expect(carga?.celdas.nulo).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(porNombre.get('Violencia')?.celdas.nulo.n).toBe(3);
  });
});
