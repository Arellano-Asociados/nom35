import { describe, expect, it } from 'vitest';
import type { DatosInforme79 } from '../lib/informe';
import { generarPdfInforme79 } from './generar-pdf';

// Smoke test únicamente: este módulo solo renderiza `DatosInforme79` (ya armado
// por `armarDatosInforme79`) a bytes de PDF. No valida layout/visual (eso es
// responsabilidad del E2E/revisión manual), solo que el resultado sea un PDF
// real y no un documento trivial/vacío.

const DATOS_DE_EJEMPLO: DatosInforme79 = {
  empresa: { razonSocial: 'Acme S.A. de C.V.', rfc: 'ACM010101AAA' },
  centros: [
    {
      nombre: 'Centro Norte',
      domicilio: 'Av. Siempre Viva 123, CDMX',
      actividad: 'Manufactura',
      headcount: 30,
      nomCategory: 'gr1_gr2',
      guias: ['GR-I', 'GR-II'],
    },
  ],
  ciclo: {
    nombre: 'Ciclo 2026',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-03-01',
    evaluadorNombre: 'Jane Doe',
    evaluadorCedula: '12345678',
  },
  participacion: { asignados: 5, completados: 5 },
  resultados: {
    global: {
      total: 5,
      totalSuprimido: false,
      celdas: {
        nulo: { n: 3, porcentaje: 60, suprimida: false },
        bajo: { n: 0, porcentaje: 0, suprimida: false },
        // n=1: 0 < n < 3, celda suprimida por anti-reidentificación (regla inviolable 3)
        medio: { n: null, porcentaje: null, suprimida: true },
        alto: { n: null, porcentaje: null, suprimida: true },
        muy_alto: { n: 0, porcentaje: 0, suprimida: false },
      },
    },
    categorias: new Map([
      [
        'Carga de trabajo',
        {
          total: 5,
          totalSuprimido: false,
          celdas: {
            nulo: { n: 3, porcentaje: 60, suprimida: false },
            bajo: { n: 0, porcentaje: 0, suprimida: false },
            medio: { n: null, porcentaje: null, suprimida: true },
            alto: { n: null, porcentaje: null, suprimida: true },
            muy_alto: { n: 0, porcentaje: 0, suprimida: false },
          },
        },
      ],
    ]),
    dominios: new Map([
      [
        'Ambiente de trabajo',
        {
          total: 5,
          totalSuprimido: false,
          celdas: {
            nulo: { n: 5, porcentaje: 100, suprimida: false },
            bajo: { n: 0, porcentaje: 0, suprimida: false },
            medio: { n: 0, porcentaje: 0, suprimida: false },
            alto: { n: 0, porcentaje: 0, suprimida: false },
            muy_alto: { n: 0, porcentaje: 0, suprimida: false },
          },
        },
      ],
    ]),
  },
  gr1: { evaluados: 5, requierenValoracion: null },
  conclusiones: [
    'El nivel de riesgo predominante en la organización es Nulo.',
    'Esta evaluación debe repetirse en un plazo no mayor a dos años, conforme al numeral 7.9 de la NOM-035-STPS-2018.',
  ],
  acciones: [
    {
      descripcion: 'Capacitación en manejo de carga de trabajo.',
      nivelOrigen: 'medio',
      responsable: 'Responsable Designado',
      fechaCompromiso: '2026-06-01',
      estatus: 'pendiente',
    },
  ],
  motorVersion: '0.1.0',
  generadoEl: '2026-07-11T12:00:00.000Z',
};

describe('generarPdfInforme79', () => {
  it('produce un Buffer con encabezado %PDF y tamaño > 1KB', async () => {
    const bytes = await generarPdfInforme79(DATOS_DE_EJEMPLO);

    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    expect(bytes.length).toBeGreaterThan(1024);
  });
});
