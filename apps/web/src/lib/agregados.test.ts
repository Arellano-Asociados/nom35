import { describe, expect, it } from 'vitest';
import {
  distribucionNiveles,
  distribucionPorNombre,
  NIVELES,
  type Distribucion,
} from './agregados';

// Reglas inviolables 2 y 3: agregados = distribuciones y conteos (JAMÁS promedios);
// toda celda con 0 < n < 3 se suprime Y, desde la corrección de la auditoría v0, se
// enmascara la FILA COMPLETA (todas las celdas, incluidos los ceros, y el total):
// publicar ceros junto a una celda enmascarada revela el NIVEL del individuo aunque
// oculte su conteo.

/** Una fila está bien protegida si no publica NADA: ni conteos, ni ceros, ni total. */
function filaTotalmenteEnmascarada(d: Distribucion): boolean {
  return (
    d.totalSuprimido &&
    d.total === null &&
    NIVELES.every((nivel) => {
      const c = d.celdas[nivel];
      return c.suprimida && c.n === null && c.porcentaje === null;
    })
  );
}

describe('distribucionNiveles', () => {
  it('cuenta y calcula porcentajes por nivel cuando ninguna celda cae en 0 < n < 3', () => {
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
    expect(d.celdas.bajo).toEqual({ n: 0, porcentaje: 0, suprimida: false });
  });

  it('lista vacía: total 0 y nada que proteger (nadie respondió)', () => {
    const d = distribucionNiveles([]);
    expect(d.total).toBe(0);
    expect(d.totalSuprimido).toBe(false);
    expect(d.celdas.nulo).toEqual({ n: 0, porcentaje: 0, suprimida: false });
  });

  it('grupo de exactamente 3 en un solo nivel: se publica (3 es el umbral aceptado)', () => {
    const d = distribucionNiveles(['nulo', 'nulo', 'nulo']);
    expect(d.total).toBe(3);
    expect(d.totalSuprimido).toBe(false);
    expect(d.celdas.nulo).toEqual({ n: 3, porcentaje: 100, suprimida: false });
    expect(d.celdas.alto).toEqual({ n: 0, porcentaje: 0, suprimida: false });
  });
});

describe('anti-reidentificación: enmascarado de fila completa', () => {
  // Estos son los casos que la auditoría v0 encontró abiertos: la supresión por celda
  // ocultaba el conteo pero NO el nivel del individuo.

  it('UN respondiente: ninguna celda revela su nivel (fila completa enmascarada)', () => {
    const d = distribucionNiveles(['medio']);
    expect(filaTotalmenteEnmascarada(d)).toBe(true);
    // El defecto original: 'medio' quedaba como [<3] y las otras cuatro como 0 (0%),
    // de modo que el único nivel no-cero delataba el resultado de esa persona.
    for (const nivel of NIVELES) {
      expect(d.celdas[nivel].n).toBeNull();
    }
    expect(d.total).toBeNull();
  });

  it('UN respondiente en cada nivel posible: en ningún caso se filtra el nivel', () => {
    for (const nivel of NIVELES) {
      const d = distribucionNiveles([nivel]);
      expect(filaTotalmenteEnmascarada(d)).toBe(true);
    }
  });

  it('DOS respondientes del mismo nivel: fila completa enmascarada', () => {
    const d = distribucionNiveles(['alto', 'alto']);
    expect(filaTotalmenteEnmascarada(d)).toBe(true);
  });

  it('DOS respondientes de niveles distintos: fila completa enmascarada', () => {
    const d = distribucionNiveles(['nulo', 'muy_alto']);
    expect(filaTotalmenteEnmascarada(d)).toBe(true);
  });

  it('una celda pequeña dentro de un grupo grande enmascara toda la fila', () => {
    // 3 nulo + 1 alto: antes 'alto' se enmascaraba y 'nulo' se suprimía por la regla
    // complementaria, pero bajo/medio/muy_alto seguían publicándose en 0 — y el total
    // (4) seguía visible. Ahora no se publica nada de la fila.
    const d = distribucionNiveles(['nulo', 'nulo', 'nulo', 'alto']);
    expect(filaTotalmenteEnmascarada(d)).toBe(true);
  });

  it('dos celdas pequeñas y una grande: también se enmascara toda la fila', () => {
    // nulo=1, bajo=2, medio=5. Antes se publicaba medio=5 y los ceros de alto/muy_alto.
    const d = distribucionNiveles([
      'nulo',
      'bajo',
      'bajo',
      'medio',
      'medio',
      'medio',
      'medio',
      'medio',
    ]);
    expect(filaTotalmenteEnmascarada(d)).toBe(true);
  });

  it('propiedad: si alguna celda está suprimida, TODAS lo están y el total también', () => {
    // Barrido exhaustivo de composiciones pequeñas (hasta 6 personas en 5 niveles):
    // ninguna combinación debe dejar una celda publicada junto a otra suprimida.
    const combinaciones: string[][] = [];
    const generar = (acc: string[], restantes: number) => {
      combinaciones.push([...acc]);
      if (restantes === 0) return;
      for (const nivel of NIVELES) generar([...acc, nivel], restantes - 1);
    };
    generar([], 5);

    for (const muestra of combinaciones) {
      const d = distribucionNiveles(muestra);
      const alguna = NIVELES.some((nivel) => d.celdas[nivel].suprimida);
      if (alguna) {
        expect(filaTotalmenteEnmascarada(d)).toBe(true);
      } else {
        // Sin celdas suprimidas, nada se oculta: el total se publica.
        expect(d.totalSuprimido).toBe(false);
        expect(d.total).toBe(muestra.length);
      }
    }
  });
});

describe('distribucionPorNombre', () => {
  it('agrupa por categoría o dominio y enmascara por fila de forma independiente', () => {
    const filas = [
      // Carga de trabajo: 3 alto + 1 nulo → la celda de 1 enmascara toda su fila.
      { nombre: 'Carga de trabajo', nivel: 'alto' },
      { nombre: 'Carga de trabajo', nivel: 'alto' },
      { nombre: 'Carga de trabajo', nivel: 'alto' },
      { nombre: 'Carga de trabajo', nivel: 'nulo' },
      // Violencia: 3 nulo → sin celdas pequeñas, se publica.
      { nombre: 'Violencia', nivel: 'nulo' },
      { nombre: 'Violencia', nivel: 'nulo' },
      { nombre: 'Violencia', nivel: 'nulo' },
    ];
    const porNombre = distribucionPorNombre(filas);

    const carga = porNombre.get('Carga de trabajo');
    expect(carga && filaTotalmenteEnmascarada(carga)).toBe(true);

    const violencia = porNombre.get('Violencia');
    expect(violencia?.totalSuprimido).toBe(false);
    expect(violencia?.celdas.nulo.n).toBe(3);
  });
});
