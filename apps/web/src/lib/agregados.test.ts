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
    // 'nulo' (n=1) se suprime por la regla base (0<n<3). Es la ÚNICA celda suprimida
    // del grupo y la única celda visible positiva es 'alto' (n=3): sin supresión
    // complementaria, total(4) - alto(3) = 1 recuperaría exactamente el valor de
    // 'nulo'. Por eso 'alto', al ser la celda visible de menor n positivo (aquí la
    // única), también se suprime. El total permanece visible porque ahora hay DOS
    // celdas suprimidas: la resta solo revela su suma (4), no cada valor individual.
    // (Expectativa actualizada conscientemente por la regla de supresión
    // complementaria de esta tarea; antes 'alto' quedaba visible con n:3.)
    expect(carga?.celdas.alto).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(carga?.celdas.nulo).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(carga?.total).toBe(4);
    expect(carga?.totalSuprimido).toBe(false);
    expect(porNombre.get('Violencia')?.celdas.nulo.n).toBe(3);
  });
});

describe('supresión complementaria (evita recuperación por resta)', () => {
  it('(a) una sola celda suprimida con una celda visible positiva: también se suprime la de menor n', () => {
    // 3 nulo + 1 alto (total 4): la base suprime 'alto' (n=1); sin regla
    // complementaria, total(4) - nulo(3) = 1 recuperaría 'alto'. La única celda
    // visible positiva es 'nulo' (n=3): se suprime también.
    const d = distribucionNiveles(['nulo', 'nulo', 'nulo', 'alto']);
    expect(d.total).toBe(4);
    expect(d.totalSuprimido).toBe(false);
    expect(d.celdas.alto).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(d.celdas.nulo).toEqual({ n: null, porcentaje: null, suprimida: true });
    // Las celdas en 0 no revelan nada por resta (no se tocan).
    expect(d.celdas.bajo).toEqual({ n: 0, porcentaje: 0, suprimida: false });
    expect(d.celdas.medio).toEqual({ n: 0, porcentaje: 0, suprimida: false });
    expect(d.celdas.muy_alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
  });

  it('(b) dos celdas ya suprimidas: no se suprime nada adicional', () => {
    // nulo=1 (suprimida), bajo=2 (suprimida), medio=5 (visible), alto=0, muy_alto=0.
    const niveles = ['nulo', 'bajo', 'bajo', 'medio', 'medio', 'medio', 'medio', 'medio'];
    const d = distribucionNiveles(niveles);
    expect(d.total).toBe(8);
    expect(d.totalSuprimido).toBe(false);
    expect(d.celdas.nulo).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(d.celdas.bajo).toEqual({ n: null, porcentaje: null, suprimida: true });
    // La resta solo revela la SUMA de las dos suprimidas (3), no cada valor: medio
    // (la única celda visible positiva) permanece visible, sin tocar.
    expect(d.celdas.medio).toEqual({ n: 5, porcentaje: 63, suprimida: false });
    expect(d.celdas.alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
    expect(d.celdas.muy_alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
  });

  it('(c) ninguna celda suprimida: la distribución no cambia', () => {
    const d = distribucionNiveles(['nulo', 'nulo', 'nulo', 'nulo', 'nulo', 'alto', 'alto', 'alto']);
    expect(d.total).toBe(8);
    expect(d.totalSuprimido).toBe(false);
    expect(d.celdas.nulo).toEqual({ n: 5, porcentaje: 63, suprimida: false });
    expect(d.celdas.alto).toEqual({ n: 3, porcentaje: 38, suprimida: false });
    expect(d.celdas.bajo).toEqual({ n: 0, porcentaje: 0, suprimida: false });
  });

  it('(d) una celda suprimida y el resto en 0: no hay celda complementaria positiva, se suprime el TOTAL', () => {
    // total 1, 'nulo' n=1 suprimida, todas las demás en 0: total(1) - 0 - 0 - 0 - 0 = 1
    // recuperaría exactamente el valor de la celda suprimida. No existe ninguna celda
    // visible positiva que suprimir en su lugar, así que se oculta el total del grupo.
    const d = distribucionNiveles(['nulo']);
    expect(d.totalSuprimido).toBe(true);
    expect(d.total).toBeNull();
    expect(d.celdas.nulo).toEqual({ n: null, porcentaje: null, suprimida: true });
    // Las celdas en 0 se conservan visibles (no reidentifican por sí solas).
    expect(d.celdas.bajo).toEqual({ n: 0, porcentaje: 0, suprimida: false });
    expect(d.celdas.medio).toEqual({ n: 0, porcentaje: 0, suprimida: false });
    expect(d.celdas.alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
    expect(d.celdas.muy_alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
  });
});
