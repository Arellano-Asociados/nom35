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

  it('(b)/(g) dos celdas suprimidas (n=1 y n=2) con descomposición NO única: no se suprime nada adicional', () => {
    // nulo=1 (suprimida), bajo=2 (suprimida), medio=5 (visible), alto=0, muy_alto=0.
    // k=2 celdas suprimidas, S = total(8) - visibles(5) = 3. Descomposición sobre 2
    // celdas ∈{1,2}: S===k sería 3===2 (falso), S===2k sería 3===4 (falso) → NO es
    // única: (nulo=1,bajo=2) y (nulo=2,bajo=1) son ambas consistentes con S=3, así
    // que la resta no aísla ningún valor y no hace falta supresión complementaria.
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

  it('(e) dos celdas suprimidas con descomposición forzada (S=k=2, ambas valen 1): sin celda visible positiva, se oculta el total', () => {
    // Hallazgo del revisor: distribucionNiveles(['nulo','bajo']) — total 2, nulo=1 y
    // bajo=1 (ambas suprimidas por la regla base, k=2). S = total(2) - visibles(0) = 2
    // = k → única descomposición posible: AMBAS valen 1 (la única forma de sumar 2
    // con 2 celdas ∈{1,2} es 1+1). Antes de esta tarea la regla base (suprimidasCount
    // !== 1) no hacía nada aquí, dejando el total(2) visible y revelando ambos
    // valores por resta. No hay ninguna celda visible positiva (medio/alto/muy_alto
    // están en 0) para aplicar la supresión complementaria de celda, así que se oculta
    // el TOTAL del grupo completo.
    const d = distribucionNiveles(['nulo', 'bajo']);
    expect(d.celdas.nulo).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(d.celdas.bajo).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(d.totalSuprimido).toBe(true);
    expect(d.total).toBeNull();
    expect(d.celdas.medio).toEqual({ n: 0, porcentaje: 0, suprimida: false });
    expect(d.celdas.alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
    expect(d.celdas.muy_alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
  });

  it('(f) tres celdas suprimidas con descomposición forzada (S=k=3, las tres valen 1): se oculta el total', () => {
    // Hallazgo del revisor: distribucionNiveles(['nulo','bajo','medio']) — total 3,
    // las tres celdas =1 (suprimidas por la regla base, k=3). S = total(3) -
    // visibles(0) = 3 = k → única descomposición: las tres valen 1 (única forma de
    // sumar 3 con 3 celdas ∈{1,2}). Sin celda visible positiva → se oculta el total.
    const d = distribucionNiveles(['nulo', 'bajo', 'medio']);
    expect(d.celdas.nulo).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(d.celdas.bajo).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(d.celdas.medio).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(d.totalSuprimido).toBe(true);
    expect(d.total).toBeNull();
    expect(d.celdas.alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
    expect(d.celdas.muy_alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
  });

  it('(h) dos celdas suprimidas ambas =2 (S=2k=4, forzada) con una celda visible positiva: también se suprime la visible', () => {
    // nulo=2, bajo=2 (ambas suprimidas por la regla base, k=2), medio=3 (visible,
    // no suprimida por la regla base porque 3 no es < 3), alto=0, muy_alto=0.
    // total=7. S = total(7) - visibles(medio=3) = 4 = 2k (2*2) → única
    // descomposición: AMBAS suprimidas valen 2 (única forma de sumar 4 con 2 celdas
    // ∈{1,2} es 2+2). Existe una celda visible positiva (medio=3): se suprime
    // también para que la resta ya no aísle los valores de nulo/bajo.
    const niveles = ['nulo', 'nulo', 'bajo', 'bajo', 'medio', 'medio', 'medio'];
    const d = distribucionNiveles(niveles);
    expect(d.total).toBe(7);
    expect(d.totalSuprimido).toBe(false);
    expect(d.celdas.nulo).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(d.celdas.bajo).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(d.celdas.medio).toEqual({ n: null, porcentaje: null, suprimida: true });
    expect(d.celdas.alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
    expect(d.celdas.muy_alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
  });
});
