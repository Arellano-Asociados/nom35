import { describe, expect, it } from 'vitest';
import { GR2, GR3, REGLAS_GR1 } from './datos';

// Verificación de integridad de los datos normativos (fuente: DOF 23-oct-2018).
// Los valores esperados están transcritos AQUÍ de forma independiente para que un error de
// captura en src/datos/ no pueda pasar inadvertido.

const serie = (desde: number, hasta: number): number[] =>
  Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

const itemsDeDominio = (guia: typeof GR2 | typeof GR3, nombre: string): number[] => {
  const dominio = guia.dominios.find((d) => d.nombre === nombre);
  if (!dominio) throw new Error(`Dominio no encontrado: ${nombre}`);
  return [...dominio.items].sort((a, b) => a - b);
};

const itemsDeCategoria = (guia: typeof GR2 | typeof GR3, nombre: string): number[] => {
  const categoria = guia.categorias.find((c) => c.nombre === nombre);
  if (!categoria) throw new Error(`Categoría no encontrada: ${nombre}`);
  return [...categoria.items].sort((a, b) => a - b);
};

describe('reglas de puntaje (scoring_rules)', () => {
  it.each([GR2, GR3])('$guia: grupo A directo (Siempre=0 … Nunca=4)', (guia) => {
    expect(guia.puntajes.A).toEqual({
      siempre: 0,
      casi_siempre: 1,
      algunas_veces: 2,
      casi_nunca: 3,
      nunca: 4,
    });
  });

  it.each([GR2, GR3])('$guia: grupo B inverso (Siempre=4 … Nunca=0)', (guia) => {
    expect(guia.puntajes.B).toEqual({
      siempre: 4,
      casi_siempre: 3,
      algunas_veces: 2,
      casi_nunca: 1,
      nunca: 0,
    });
  });
});

describe('GR-III (72 ítems, centros de trabajo con más de 50 trabajadores)', () => {
  it('tiene 72 ítems con grupo asignado y los grupos A y B del DOF', () => {
    const grupoA = [
      1, 4, 23, 24, 25, 26, 27, 28, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
      46, 47, 48, 49, 50, 51, 52, 53, 55, 56, 57,
    ];
    expect(GR3.totalItems).toBe(72);
    const itemsA = serie(1, 72).filter((i) => GR3.grupoDeItem[i] === 'A');
    const itemsB = serie(1, 72).filter((i) => GR3.grupoDeItem[i] === 'B');
    expect(itemsA).toEqual(grupoA);
    expect(itemsB).toEqual(serie(1, 72).filter((i) => !grupoA.includes(i)));
  });

  it('rangos de Cfinal: <50 / <75 / <99 / <140 / ≥140', () => {
    expect(GR3.rangoCfinal).toEqual({ nuloMax: 50, bajoMax: 75, medioMax: 99, altoMax: 140 });
  });

  it('los 10 dominios particionan los ítems 1–72 con sus rangos del DOF', () => {
    const esperado: Record<string, { items: number[]; rango: number[] }> = {
      'Condiciones en el ambiente de trabajo': { items: serie(1, 5), rango: [5, 9, 11, 14] },
      'Carga de trabajo': { items: [...serie(6, 16), ...serie(65, 68)], rango: [15, 21, 27, 37] },
      'Falta de control sobre el trabajo': {
        items: [...serie(23, 30), 35, 36],
        rango: [11, 16, 21, 25],
      },
      'Jornada de trabajo': { items: [17, 18], rango: [1, 2, 4, 6] },
      'Interferencia en la relación trabajo-familia': {
        items: serie(19, 22),
        rango: [4, 6, 8, 10],
      },
      Liderazgo: { items: [...serie(31, 34), ...serie(37, 41)], rango: [9, 12, 16, 20] },
      'Relaciones en el trabajo': {
        items: [...serie(42, 46), ...serie(69, 72)],
        rango: [10, 13, 17, 21],
      },
      Violencia: { items: serie(57, 64), rango: [7, 10, 13, 16] },
      'Reconocimiento del desempeño': { items: serie(47, 52), rango: [6, 10, 14, 18] },
      'Insuficiente sentido de pertenencia e inestabilidad': {
        items: serie(53, 56),
        rango: [4, 6, 8, 10],
      },
    };
    expect(GR3.dominios.map((d) => d.nombre).sort()).toEqual(Object.keys(esperado).sort());
    for (const [nombre, def] of Object.entries(esperado)) {
      expect(itemsDeDominio(GR3, nombre), nombre).toEqual([...def.items].sort((a, b) => a - b));
      const dominio = GR3.dominios.find((d) => d.nombre === nombre);
      const [nuloMax, bajoMax, medioMax, altoMax] = def.rango;
      expect(dominio?.rango, nombre).toEqual({ nuloMax, bajoMax, medioMax, altoMax });
    }
    // Partición exacta: cada ítem 1–72 aparece en exactamente un dominio
    const todos = GR3.dominios.flatMap((d) => [...d.items]).sort((a, b) => a - b);
    expect(todos).toEqual(serie(1, 72));
  });

  it('las 5 categorías agrupan sus dominios con los rangos del DOF', () => {
    const esperado: Record<string, { items: number[]; rango: number[] }> = {
      'Ambiente de trabajo': { items: serie(1, 5), rango: [5, 9, 11, 14] },
      'Factores propios de la actividad': {
        items: [...serie(6, 16), ...serie(65, 68), ...serie(23, 30), 35, 36],
        rango: [15, 30, 45, 60],
      },
      'Organización del tiempo de trabajo': { items: serie(17, 22), rango: [5, 7, 10, 13] },
      'Liderazgo y relaciones en el trabajo': {
        items: [
          ...serie(31, 34),
          ...serie(37, 41),
          ...serie(42, 46),
          ...serie(69, 72),
          ...serie(57, 64),
        ],
        rango: [14, 29, 42, 58],
      },
      'Entorno organizacional': { items: serie(47, 56), rango: [10, 14, 18, 23] },
    };
    expect(GR3.categorias.map((c) => c.nombre).sort()).toEqual(Object.keys(esperado).sort());
    for (const [nombre, def] of Object.entries(esperado)) {
      expect(itemsDeCategoria(GR3, nombre), nombre).toEqual([...def.items].sort((a, b) => a - b));
      const categoria = GR3.categorias.find((c) => c.nombre === nombre);
      const [nuloMax, bajoMax, medioMax, altoMax] = def.rango;
      expect(categoria?.rango, nombre).toEqual({ nuloMax, bajoMax, medioMax, altoMax });
    }
    // En la GR-III las categorías también particionan 1–72
    const todos = GR3.categorias.flatMap((c) => [...c.items]).sort((a, b) => a - b);
    expect(todos).toEqual(serie(1, 72));
    // Los ítems de cada categoría son la unión de los de sus dominios
    for (const categoria of GR3.categorias) {
      const deSusDominios = categoria.dominios
        .flatMap((nombre) => itemsDeDominio(GR3, nombre))
        .sort((a, b) => a - b);
      expect(itemsDeCategoria(GR3, categoria.nombre), categoria.nombre).toEqual(deSusDominios);
    }
  });

  it('condicionales: 65–68 atiende clientes, 69–72 supervisa personal (todos grupo B)', () => {
    expect([...GR3.itemsCondicionales.atiendeClientes]).toEqual([65, 66, 67, 68]);
    expect([...GR3.itemsCondicionales.supervisaPersonal]).toEqual([69, 70, 71, 72]);
    for (const item of [...serie(65, 68), ...serie(69, 72)]) {
      expect(GR3.grupoDeItem[item], `ítem ${item}`).toBe('B');
    }
  });
});

describe('GR-II (46 ítems, centros de trabajo de 16 a 50 trabajadores)', () => {
  it('tiene 46 ítems: grupo A = 18–33, grupo B = 1–17 y 34–46', () => {
    expect(GR2.totalItems).toBe(46);
    const itemsA = serie(1, 46).filter((i) => GR2.grupoDeItem[i] === 'A');
    const itemsB = serie(1, 46).filter((i) => GR2.grupoDeItem[i] === 'B');
    expect(itemsA).toEqual(serie(18, 33));
    expect(itemsB).toEqual([...serie(1, 17), ...serie(34, 46)]);
  });

  it('rangos de Cfinal: <20 / <45 / <70 / <90 / ≥90', () => {
    expect(GR2.rangoCfinal).toEqual({ nuloMax: 20, bajoMax: 45, medioMax: 70, altoMax: 90 });
  });

  it('los 8 dominios particionan los ítems 1–46 con sus rangos del DOF', () => {
    const esperado: Record<string, { items: number[]; rango: number[] }> = {
      'Condiciones en el ambiente de trabajo': { items: serie(1, 3), rango: [3, 5, 7, 9] },
      'Carga de trabajo': { items: [...serie(4, 13), ...serie(41, 43)], rango: [12, 16, 20, 24] },
      'Falta de control sobre el trabajo': {
        items: [...serie(18, 22), 26, 27],
        rango: [5, 8, 11, 14],
      },
      'Jornada de trabajo': { items: [14, 15], rango: [1, 2, 4, 6] },
      'Interferencia en la relación trabajo-familia': { items: [16, 17], rango: [1, 2, 4, 6] },
      Liderazgo: { items: [...serie(23, 25), 28, 29], rango: [3, 5, 8, 11] },
      'Relaciones en el trabajo': {
        items: [...serie(30, 32), ...serie(44, 46)],
        rango: [5, 8, 11, 14],
      },
      Violencia: { items: serie(33, 40), rango: [7, 10, 13, 16] },
    };
    expect(GR2.dominios.map((d) => d.nombre).sort()).toEqual(Object.keys(esperado).sort());
    for (const [nombre, def] of Object.entries(esperado)) {
      expect(itemsDeDominio(GR2, nombre), nombre).toEqual([...def.items].sort((a, b) => a - b));
      const dominio = GR2.dominios.find((d) => d.nombre === nombre);
      const [nuloMax, bajoMax, medioMax, altoMax] = def.rango;
      expect(dominio?.rango, nombre).toEqual({ nuloMax, bajoMax, medioMax, altoMax });
    }
    const todos = GR2.dominios.flatMap((d) => [...d.items]).sort((a, b) => a - b);
    expect(todos).toEqual(serie(1, 46));
  });

  it('las 4 categorías tienen los ítems y rangos del DOF (18 y 19 NO puntúan en Factores propios)', () => {
    const esperado: Record<string, { items: number[]; rango: number[] }> = {
      'Ambiente de trabajo': { items: serie(1, 3), rango: [3, 5, 7, 9] },
      'Factores propios de la actividad': {
        items: [...serie(4, 13), ...serie(20, 22), 26, 27, ...serie(41, 43)],
        rango: [10, 20, 30, 40],
      },
      'Organización del tiempo de trabajo': { items: serie(14, 17), rango: [4, 6, 9, 12] },
      'Liderazgo y relaciones en el trabajo': {
        items: [...serie(23, 25), ...serie(28, 40), ...serie(44, 46)],
        rango: [10, 18, 28, 38],
      },
    };
    expect(GR2.categorias.map((c) => c.nombre).sort()).toEqual(Object.keys(esperado).sort());
    for (const [nombre, def] of Object.entries(esperado)) {
      expect(itemsDeCategoria(GR2, nombre), nombre).toEqual([...def.items].sort((a, b) => a - b));
      const categoria = GR2.categorias.find((c) => c.nombre === nombre);
      const [nuloMax, bajoMax, medioMax, altoMax] = def.rango;
      expect(categoria?.rango, nombre).toEqual({ nuloMax, bajoMax, medioMax, altoMax });
    }
  });

  it('condicionales: 41–43 atiende clientes, 44–46 supervisa personal (todos grupo B)', () => {
    expect([...GR2.itemsCondicionales.atiendeClientes]).toEqual([41, 42, 43]);
    expect([...GR2.itemsCondicionales.supervisaPersonal]).toEqual([44, 45, 46]);
    for (const item of serie(41, 46)) {
      expect(GR2.grupoDeItem[item], `ítem ${item}`).toBe('B');
    }
  });
});

describe('REGLAS_GR1 (acontecimientos traumáticos severos)', () => {
  it('umbrales de valoración clínica: ≥1 Sí en II, ≥3 Sí en III, ≥2 Sí en IV', () => {
    expect(REGLAS_GR1).toEqual({
      minSiSeccionII: 1,
      minSiSeccionIII: 3,
      minSiSeccionIV: 2,
    });
  });
});
