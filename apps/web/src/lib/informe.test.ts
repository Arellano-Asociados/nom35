import { MOTOR_NOM035_VERSION } from '@nom35/motor-nom035';
import { describe, expect, it } from 'vitest';
import {
  armarDatosInforme79,
  resultadosVigentesPorAsignacion,
  type EntradaAccion,
  type EntradaAsignacion,
  type EntradaCentro,
  type EntradaInforme79,
  type EntradaResultado,
  type EntradaResultadoGr1,
} from './informe';

// Reglas inviolables: sin promedios (solo distribuciones/conteos), supresión n<3,
// y "nada normativo hardcodeado" — este módulo solo arma datos ya calculados por el
// motor y por las tablas de agregados; no vuelve a calificar nada.

const EMPRESA_BASE: EntradaInforme79['empresa'] = {
  razonSocial: 'Acme S.A. de C.V.',
  rfc: 'ACM010101AAA',
};

const CICLO_BASE: EntradaInforme79['ciclo'] = {
  nombre: 'Ciclo 2026',
  fechaInicio: '2026-01-01',
  fechaFin: null,
  evaluadorNombre: 'Jane Doe',
  evaluadorCedula: '12345678',
};

function resultado(
  parcial: Partial<EntradaResultado> & { id: string; assignmentId: string },
): EntradaResultado {
  return {
    supersedesId: null,
    createdAt: '2026-01-10T00:00:00.000Z',
    nivelFinal: 'nulo',
    categorias: [],
    dominios: [],
    engineVersion: '0.1.0',
    ...parcial,
  };
}

function asignaciones(n: number, completadas = n): EntradaAsignacion[] {
  return Array.from({ length: n }, (_, i) => ({ id: `asig-${i}`, completada: i < completadas }));
}

function baseEntrada(overrides: Partial<EntradaInforme79>): EntradaInforme79 {
  return {
    empresa: EMPRESA_BASE,
    centros: [
      {
        nombre: 'Centro Norte',
        domicilio: 'Av. Siempre Viva 123',
        actividad: 'Manufactura',
        headcount: 30,
        nomCategory: 'gr1_gr2',
      },
    ],
    ciclo: CICLO_BASE,
    asignaciones: [],
    resultadosVigentes: [],
    resultadosGr1: [],
    acciones: [],
    generadoEl: '2026-07-11T12:00:00.000Z',
    ...overrides,
  };
}

describe('armarDatosInforme79', () => {
  it('(a) arma el informe feliz con 5 resultados mezclados y distribución correcta', () => {
    const resultadosVigentes: EntradaResultado[] = [
      resultado({
        id: 'r1',
        assignmentId: 'asig-0',
        nivelFinal: 'nulo',
        categorias: [{ nombre: 'Carga de trabajo', nivel: 'nulo' }],
      }),
      resultado({
        id: 'r2',
        assignmentId: 'asig-1',
        nivelFinal: 'nulo',
        categorias: [{ nombre: 'Carga de trabajo', nivel: 'nulo' }],
      }),
      resultado({
        id: 'r3',
        assignmentId: 'asig-2',
        nivelFinal: 'nulo',
        categorias: [{ nombre: 'Carga de trabajo', nivel: 'nulo' }],
      }),
      resultado({
        id: 'r4',
        assignmentId: 'asig-3',
        nivelFinal: 'alto',
        categorias: [{ nombre: 'Carga de trabajo', nivel: 'alto' }],
      }),
      resultado({
        id: 'r5',
        assignmentId: 'asig-4',
        nivelFinal: 'medio',
        categorias: [{ nombre: 'Carga de trabajo', nivel: 'medio' }],
      }),
    ];
    const entrada = baseEntrada({
      asignaciones: asignaciones(5),
      resultadosVigentes,
    });

    const informe = armarDatosInforme79(entrada);

    expect(informe.participacion).toEqual({ asignados: 5, completados: 5 });
    expect(informe.resultados.global.total).toBe(5);
    expect(informe.resultados.global.celdas.nulo).toEqual({
      n: 3,
      porcentaje: 60,
      suprimida: false,
    });
    // alto y medio tienen n=1 cada uno: se suprimen (0 < n < 3)
    expect(informe.resultados.global.celdas.alto).toEqual({
      n: null,
      porcentaje: null,
      suprimida: true,
    });
    expect(informe.resultados.global.celdas.medio).toEqual({
      n: null,
      porcentaje: null,
      suprimida: true,
    });
    const carga = informe.resultados.categorias.get('Carga de trabajo');
    expect(carga?.total).toBe(5);
    expect(informe.motorVersion).toBe('0.1.0');
    expect(informe.generadoEl).toBe('2026-07-11T12:00:00.000Z');
  });

  it('(b) suprime gr1.requierenValoracion a null cuando 2 de 3 requieren valoración (0<n<3)', () => {
    const resultadosGr1: EntradaResultadoGr1[] = [
      { assignmentId: 'asig-0', requiereValoracion: true },
      { assignmentId: 'asig-1', requiereValoracion: true },
      { assignmentId: 'asig-2', requiereValoracion: false },
    ];
    const entrada = baseEntrada({ asignaciones: asignaciones(3), resultadosGr1 });

    const informe = armarDatosInforme79(entrada);

    expect(informe.gr1.evaluados).toBe(3);
    expect(informe.gr1.requierenValoracion).toBeNull();
  });

  it('gr1.requierenValoracion es 0 (no null) cuando nadie requiere valoración: n=0 no es supresión', () => {
    const resultadosGr1: EntradaResultadoGr1[] = [
      { assignmentId: 'asig-0', requiereValoracion: false },
      { assignmentId: 'asig-1', requiereValoracion: false },
      { assignmentId: 'asig-2', requiereValoracion: false },
    ];
    const entrada = baseEntrada({ asignaciones: asignaciones(3), resultadosGr1 });

    const informe = armarDatosInforme79(entrada);

    expect(informe.gr1.evaluados).toBe(3);
    expect(informe.gr1.requierenValoracion).toBe(0);
  });

  it('(c) excluye el resultado superseded: solo cuenta la fila vigente por asignación', () => {
    const resultadosVigentes: EntradaResultado[] = [
      resultado({
        id: 'r1-viejo',
        assignmentId: 'asig-0',
        nivelFinal: 'muy_alto',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      resultado({
        id: 'r1-nuevo',
        assignmentId: 'asig-0',
        supersedesId: 'r1-viejo',
        nivelFinal: 'nulo',
        createdAt: '2026-02-01T00:00:00.000Z',
      }),
      resultado({ id: 'r2', assignmentId: 'asig-1', nivelFinal: 'nulo' }),
      resultado({ id: 'r3', assignmentId: 'asig-2', nivelFinal: 'nulo' }),
    ];
    const entrada = baseEntrada({ asignaciones: asignaciones(3), resultadosVigentes });

    const informe = armarDatosInforme79(entrada);

    // Si r1-viejo (muy_alto) no se excluyera, el total sería 4 y muy_alto aparecería con n=1.
    expect(informe.resultados.global.total).toBe(3);
    expect(informe.resultados.global.celdas.nulo).toEqual({
      n: 3,
      porcentaje: 100,
      suprimida: false,
    });
    expect(informe.resultados.global.celdas.muy_alto).toEqual({
      n: 0,
      porcentaje: 0,
      suprimida: false,
    });
  });

  it('(d) incluye la conclusión de obligación de acciones (Cap. 8) cuando hay nivel alto', () => {
    const resultadosVigentes: EntradaResultado[] = [
      resultado({ id: 'r1', assignmentId: 'asig-0', nivelFinal: 'alto' }),
      resultado({ id: 'r2', assignmentId: 'asig-1', nivelFinal: 'alto' }),
      resultado({ id: 'r3', assignmentId: 'asig-2', nivelFinal: 'alto' }),
    ];
    const entrada = baseEntrada({ asignaciones: asignaciones(3), resultadosVigentes });

    const informe = armarDatosInforme79(entrada);

    expect(informe.conclusiones.some((c) => c.includes('Capítulo 8'))).toBe(true);
    // El recordatorio de reevaluación a 2 años siempre está presente.
    expect(informe.conclusiones.some((c) => c.includes('dos años'))).toBe(true);
  });

  it('no incluye la conclusión de Cap. 8 cuando todos los niveles son nulo/bajo', () => {
    const resultadosVigentes: EntradaResultado[] = [
      resultado({ id: 'r1', assignmentId: 'asig-0', nivelFinal: 'nulo' }),
      resultado({ id: 'r2', assignmentId: 'asig-1', nivelFinal: 'bajo' }),
      resultado({ id: 'r3', assignmentId: 'asig-2', nivelFinal: 'nulo' }),
    ];
    const entrada = baseEntrada({ asignaciones: asignaciones(3), resultadosVigentes });

    const informe = armarDatosInforme79(entrada);

    expect(informe.conclusiones.some((c) => c.includes('Capítulo 8'))).toBe(false);
  });

  it('incluye la conclusión de Cap. 8 cuando el global es bajo pero una categoría es alto', () => {
    const resultadosVigentes: EntradaResultado[] = [
      resultado({
        id: 'r1',
        assignmentId: 'asig-0',
        nivelFinal: 'bajo',
        categorias: [{ nombre: 'Carga de trabajo', nivel: 'alto' }],
      }),
      resultado({ id: 'r2', assignmentId: 'asig-1', nivelFinal: 'bajo' }),
      resultado({ id: 'r3', assignmentId: 'asig-2', nivelFinal: 'bajo' }),
    ];
    const entrada = baseEntrada({ asignaciones: asignaciones(3), resultadosVigentes });

    const informe = armarDatosInforme79(entrada);

    // El nivel predominante sigue siendo sobre el GLOBAL (bajo), pero la obligación del
    // Capítulo 8 se dispara igual por la categoría en alto (evidencia internamente
    // consistente con la tabla de acciones, que puede listar orígenes por categoría/dominio).
    expect(informe.conclusiones.some((c) => c.includes('Bajo'))).toBe(true);
    expect(informe.conclusiones.some((c) => c.includes('Capítulo 8'))).toBe(true);
  });

  it('no incluye la conclusión de Cap. 8 cuando global, categorías y dominios son todos bajo', () => {
    const resultadosVigentes: EntradaResultado[] = [
      resultado({
        id: 'r1',
        assignmentId: 'asig-0',
        nivelFinal: 'bajo',
        categorias: [{ nombre: 'Carga de trabajo', nivel: 'bajo' }],
        dominios: [{ nombre: 'Condiciones del ambiente', nivel: 'bajo' }],
      }),
      resultado({ id: 'r2', assignmentId: 'asig-1', nivelFinal: 'bajo' }),
      resultado({ id: 'r3', assignmentId: 'asig-2', nivelFinal: 'bajo' }),
    ];
    const entrada = baseEntrada({ asignaciones: asignaciones(3), resultadosVigentes });

    const informe = armarDatosInforme79(entrada);

    expect(informe.conclusiones.some((c) => c.includes('Capítulo 8'))).toBe(false);
  });

  it('motorVersion es determinista: versiones únicas de vigentes, ordenadas y unidas', () => {
    const resultadosVigentes: EntradaResultado[] = [
      resultado({ id: 'r1', assignmentId: 'asig-0', engineVersion: '0.2.0' }),
      resultado({ id: 'r2', assignmentId: 'asig-1', engineVersion: '0.1.0' }),
    ];
    const entrada = baseEntrada({ asignaciones: asignaciones(2), resultadosVigentes });

    const informe = armarDatosInforme79(entrada);

    expect(informe.motorVersion).toBe('0.1.0, 0.2.0');
  });

  it('motorVersion cae al fallback del paquete cuando no hay vigentes', () => {
    const entrada = baseEntrada({ asignaciones: [], resultadosVigentes: [] });

    const informe = armarDatosInforme79(entrada);

    expect(informe.motorVersion).toBe(MOTOR_NOM035_VERSION);
  });

  it('(e) deriva las guías de centros a partir de nom_category', () => {
    const centros: EntradaCentro[] = [
      { nombre: 'Chico', domicilio: null, actividad: null, headcount: 10, nomCategory: 'solo_gr1' },
      {
        nombre: 'Mediano',
        domicilio: 'Calle 1',
        actividad: 'Oficinas',
        headcount: 40,
        nomCategory: 'gr1_gr2',
      },
      {
        nombre: 'Grande',
        domicilio: 'Calle 2',
        actividad: 'Planta',
        headcount: 200,
        nomCategory: 'gr1_gr3',
      },
    ];
    const entrada = baseEntrada({ centros });

    const informe = armarDatosInforme79(entrada);

    expect(informe.centros).toEqual([
      {
        nombre: 'Chico',
        domicilio: '',
        actividad: '',
        headcount: 10,
        nomCategory: 'solo_gr1',
        guias: ['GR-I'],
      },
      {
        nombre: 'Mediano',
        domicilio: 'Calle 1',
        actividad: 'Oficinas',
        headcount: 40,
        nomCategory: 'gr1_gr2',
        guias: ['GR-I', 'GR-II'],
      },
      {
        nombre: 'Grande',
        domicilio: 'Calle 2',
        actividad: 'Planta',
        headcount: 200,
        nomCategory: 'gr1_gr3',
        guias: ['GR-I', 'GR-III'],
      },
    ]);
  });

  it('pasa acciones y empresa/ciclo sin alterarlos, coercionando nulos de empresa a cadena vacía', () => {
    const acciones: EntradaAccion[] = [
      {
        descripcion: 'Capacitar a mandos medios',
        nivelOrigen: 'alto',
        responsable: 'RH',
        fechaCompromiso: '2026-08-01',
        estatus: 'pendiente',
      },
    ];
    const entrada = baseEntrada({
      empresa: { razonSocial: 'Sin RFC S.A.', rfc: null },
      acciones,
    });

    const informe = armarDatosInforme79(entrada);

    expect(informe.empresa).toEqual({ razonSocial: 'Sin RFC S.A.', rfc: '' });
    expect(informe.acciones).toEqual(acciones);
    expect(informe.ciclo).toEqual(CICLO_BASE);
  });
});

describe('resultadosVigentesPorAsignacion (exportada, genérica)', () => {
  // El dashboard administrativo consume filas de risk_results con una forma propia
  // (nivel_final/categorias/dominios/employees, sin engineVersion ni nivelFinal): la
  // función debe filtrar por vigencia sin exigir los campos que el informe 7.9 sí usa.
  it('filtra por vigencia sobre una forma mínima ajena a EntradaResultado', () => {
    interface FilaDashboard {
      id: string;
      assignmentId: string;
      supersedesId: string | null;
      createdAt: string;
      nivel_final: string;
    }

    const filas: FilaDashboard[] = [
      {
        id: 'r1-viejo',
        assignmentId: 'asig-0',
        supersedesId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        nivel_final: 'muy_alto',
      },
      {
        id: 'r1-nuevo',
        assignmentId: 'asig-0',
        supersedesId: 'r1-viejo',
        createdAt: '2026-02-01T00:00:00.000Z',
        nivel_final: 'nulo',
      },
      {
        id: 'r2',
        assignmentId: 'asig-1',
        supersedesId: null,
        createdAt: '2026-01-05T00:00:00.000Z',
        nivel_final: 'bajo',
      },
    ];

    const vigentes = resultadosVigentesPorAsignacion(filas);

    expect(vigentes).toHaveLength(2);
    expect(vigentes.map((r) => r.id).sort()).toEqual(['r1-nuevo', 'r2']);
    // La fila devuelta conserva su forma original (nivel_final incluido, no aplanado).
    expect(vigentes.find((r) => r.id === 'r1-nuevo')?.nivel_final).toBe('nulo');
  });
});
