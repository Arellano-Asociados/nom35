import { describe, expect, it } from 'vitest';
import { armarResumenDifusion, sellarResumen, type EntradaDifusion } from './difusion';

// Difusión de resultados (NOM-035 5.7 e / 7.8): la constancia que se publica a los
// trabajadores es una instantánea agregada — con la MISMA supresión n<3 y enmascarado
// de fila completa del dashboard (regla inviolable 3) — en lenguaje llano y sellada
// con sha256 sobre JSON canónico.

function entradaBase(sobrescribe: Partial<EntradaDifusion> = {}): EntradaDifusion {
  return {
    empresa: 'Tenant A, S.A. de C.V.',
    ciclo: 'Ciclo 2026',
    centroTrabajo: 'Planta Norte',
    fechaInicio: '2026-01-15',
    fechaFin: '2026-02-28',
    guias: ['GR-I', 'GR-III'],
    nivelesFinales: ['nulo', 'nulo', 'bajo', 'medio', 'nulo'],
    categorias: [
      { nombre: 'Ambiente de trabajo', nivel: 'nulo' },
      { nombre: 'Ambiente de trabajo', nivel: 'nulo' },
      { nombre: 'Ambiente de trabajo', nivel: 'nulo' },
      { nombre: 'Carga de trabajo', nivel: 'medio' },
      { nombre: 'Carga de trabajo', nivel: 'medio' },
      { nombre: 'Carga de trabajo', nivel: 'medio' },
    ],
    participacion: { asignados: 6, completados: 5 },
    accionesComprometidas: 2,
    ...sobrescribe,
  };
}

describe('armarResumenDifusion', () => {
  it('con un solo respondiente la distribución queda enmascarada COMPLETA: nada individual sobrevive', () => {
    const resumen = armarResumenDifusion(
      entradaBase({
        nivelesFinales: ['medio'],
        categorias: [{ nombre: 'Carga de trabajo', nivel: 'medio' }],
      }),
    );
    expect(resumen.distribucionGlobal.totalSuprimido).toBe(true);
    expect(resumen.distribucionGlobal.total).toBeNull();
    for (const celda of Object.values(resumen.distribucionGlobal.celdas)) {
      expect(celda.suprimida).toBe(true);
      expect(celda.n).toBeNull();
    }
    const carga = resumen.distribucionPorCategoria.find((c) => c.nombre === 'Carga de trabajo');
    expect(carga?.distribucion.totalSuprimido).toBe(true);
  });

  it('con grupos >= 3 publica conteos y porcentajes (jamás promedios)', () => {
    const resumen = armarResumenDifusion(
      entradaBase({ nivelesFinales: ['nulo', 'nulo', 'nulo', 'medio', 'medio', 'medio'] }),
    );
    expect(resumen.distribucionGlobal.total).toBe(6);
    expect(resumen.distribucionGlobal.celdas.nulo.n).toBe(3);
    expect(resumen.distribucionGlobal.celdas.medio.n).toBe(3);
  });

  it('habla en lenguaje llano: sin códigos normativos internos', () => {
    const resumen = armarResumenDifusion(entradaBase());
    const texto = resumen.parrafos.join(' ');
    expect(texto).not.toMatch(/GR-I{1,3}\b/);
    expect(texto).not.toMatch(/Cfinal/i);
    expect(resumen.notaConfidencialidad).toMatch(/nadie|ninguna persona/i);
  });

  it('incluye el enlace del buzón cuando la empresa lo activó', () => {
    const con = armarResumenDifusion(entradaBase({ urlBuzon: 'https://x.mx/buzon/abc' }));
    expect(con.urlBuzon).toBe('https://x.mx/buzon/abc');
    expect(con.parrafos.join(' ')).toMatch(/quejas|denunciar/i);
    const sin = armarResumenDifusion(entradaBase());
    expect(sin.urlBuzon).toBeUndefined();
  });
});

describe('sellarResumen', () => {
  it('el sha256 es estable ante el orden de las claves (JSON canónico)', () => {
    const resumen = armarResumenDifusion(entradaBase());
    const clon = JSON.parse(JSON.stringify(resumen)) as typeof resumen;
    // Reordenar claves del clon: reconstruir el objeto insertándolas al revés
    const alReves = Object.fromEntries(Object.entries(clon).reverse()) as typeof resumen;
    const a = sellarResumen(resumen);
    const b = sellarResumen(alReves);
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('contenido distinto produce sello distinto', () => {
    const a = sellarResumen(armarResumenDifusion(entradaBase()));
    const b = sellarResumen(armarResumenDifusion(entradaBase({ ciclo: 'Otro ciclo' })));
    expect(a.sha256).not.toBe(b.sha256);
  });
});
