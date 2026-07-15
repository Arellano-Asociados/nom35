import { describe, expect, it } from 'vitest';
// El armado del acta vive en scripts/ (lo consume purgar-empresa.mjs, Node puro); es
// lógica pura y se prueba aquí, con la suite web. Módulo JS con JSDoc, sin tipos TS.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — módulo .mjs sin declaración de tipos
import { armarActaPurga, avisosCompletos, plazoCumplido } from '../../../../scripts/acta-purga.mjs';
import { hitoPendiente } from './retencion';

const DIA_MS = 24 * 60 * 60 * 1000;
const SOLICITUD = '2026-04-01T00:00:00.000Z';
const SOLICITUD_MS = new Date(SOLICITUD).getTime();

const AVISOS_OK = [
  { hito: 1, enviado_el: '2026-04-02T09:00:00Z' },
  { hito: 30, enviado_el: '2026-05-01T09:00:00Z' },
  { hito: 60, enviado_el: '2026-05-31T09:00:00Z' },
  { hito: 85, enviado_el: '2026-06-25T09:00:00Z' },
];

const INVENTARIO_OK = {
  centros: 2,
  empleados: 30,
  ciclos: 3,
  asignaciones: 90,
  respuestas: 4100,
  resultados: 88,
  informes: 3,
  quejas: 2,
  eventos_ats: 1,
  constancias_difusion: 2,
  programas: 1,
};

const HUELLAS_OK = {
  expedientes: [{ ciclo: 'Ciclo 2026', sha256: 'aaa' }],
  informes: [{ ciclo: 'Ciclo 2026', sha256: 'bbb' }],
  constancias: [{ ciclo: 'Ciclo 2026', version: 1, sha256: 'ccc' }],
};

describe('avisosCompletos (la purga solo es defendible si se avisó)', () => {
  it('con los 4 hitos (1/30/60/85): completos', () => {
    expect(avisosCompletos(AVISOS_OK)).toBe(true);
  });

  it('con un hito faltante: incompletos', () => {
    expect(avisosCompletos(AVISOS_OK.slice(0, 3))).toBe(false);
  });

  it('sin avisos: incompletos', () => {
    expect(avisosCompletos([])).toBe(false);
  });
});

describe('plazoCumplido', () => {
  it('a los 90 días exactos aún NO (la retención debe VENCER)', () => {
    expect(plazoCumplido(SOLICITUD, SOLICITUD_MS + 90 * DIA_MS, 90)).toBe(false);
  });

  it('pasados los 90 días: sí', () => {
    expect(plazoCumplido(SOLICITUD, SOLICITUD_MS + 91 * DIA_MS, 90)).toBe(true);
  });
});

describe('hitoPendiente (cron de retención)', () => {
  it('día 1 sin avisos: toca el hito 1', () => {
    expect(hitoPendiente(SOLICITUD, SOLICITUD_MS + 1 * DIA_MS, [])).toBe(1);
  });

  it('día 15 con el hito 1 enviado: nada pendiente', () => {
    expect(hitoPendiente(SOLICITUD, SOLICITUD_MS + 15 * DIA_MS, [1])).toBeNull();
  });

  it('día 31 con el hito 1 enviado: toca el 30', () => {
    expect(hitoPendiente(SOLICITUD, SOLICITUD_MS + 31 * DIA_MS, [1])).toBe(30);
  });

  it('cron caído varios días: envía el hito MÁS RECIENTE alcanzado, no todos', () => {
    expect(hitoPendiente(SOLICITUD, SOLICITUD_MS + 62 * DIA_MS, [1])).toBe(60);
  });

  it('idempotencia: mismo día, hito ya enviado → null (no reenvía)', () => {
    expect(hitoPendiente(SOLICITUD, SOLICITUD_MS + 30 * DIA_MS, [1, 30])).toBeNull();
  });

  it('día 0 (recién solicitada): nada pendiente aún', () => {
    expect(hitoPendiente(SOLICITUD, SOLICITUD_MS + 12 * 60 * 60 * 1000, [])).toBeNull();
  });
});

describe('armarActaPurga (acta CON INVENTARIO, decisión 7)', () => {
  it('arma el acta con conteos por entidad y huellas (jamás contenido)', () => {
    const acta = armarActaPurga({
      empresa: { legal_name: 'Empresa X', rfc: 'XAXX010101000', deletion_requested_at: SOLICITUD },
      avisos: AVISOS_OK,
      inventario: INVENTARIO_OK,
      huellas: HUELLAS_OK,
    });
    expect(acta.legal_name).toBe('Empresa X');
    expect(acta.inventario).toEqual(INVENTARIO_OK);
    expect(acta.huellas.constancias[0]).toEqual({ ciclo: 'Ciclo 2026', version: 1, sha256: 'ccc' });
    expect(acta.avisos.map((a: { hito: number }) => a.hito)).toEqual([1, 30, 60, 85]);
    // El acta lleva huellas y conteos, nunca contenido de respuestas/resultados.
    expect(JSON.stringify(acta)).not.toMatch(/nivel_final|answer|cfinal/);
  });

  it('inventario incompleto: el acta NO se arma (y sin acta no hay purga)', () => {
    const incompleto: Partial<typeof INVENTARIO_OK> = { ...INVENTARIO_OK };
    delete incompleto.respuestas;
    expect(() =>
      armarActaPurga({
        empresa: { legal_name: 'X', rfc: null, deletion_requested_at: SOLICITUD },
        avisos: AVISOS_OK,
        inventario: incompleto,
        huellas: HUELLAS_OK,
      }),
    ).toThrow(/[Ii]nventario incompleto/);
  });

  it('avisos incompletos: el acta NO se arma', () => {
    expect(() =>
      armarActaPurga({
        empresa: { legal_name: 'X', rfc: null, deletion_requested_at: SOLICITUD },
        avisos: AVISOS_OK.slice(1),
        inventario: INVENTARIO_OK,
        huellas: HUELLAS_OK,
      }),
    ).toThrow(/faltan avisos/);
  });
});
