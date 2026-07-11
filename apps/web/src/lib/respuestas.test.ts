import { GR3 } from '@nom35/motor-nom035';
import { describe, expect, it } from 'vitest';
import {
  construirEntradaGR1,
  construirEntradaLikert,
  ultimaRespuestaPorItem,
  type FilaRespuesta,
} from './respuestas';

const fila = (
  parcial: Partial<FilaRespuesta> & { item_number: number; answer: string },
): FilaRespuesta => ({
  id: parcial.id ?? crypto.randomUUID(),
  section: parcial.section ?? null,
  answered_at: parcial.answered_at ?? '2026-07-11T10:00:00Z',
  ...parcial,
});

describe('ultimaRespuestaPorItem', () => {
  it('con correcciones, gana la fila más reciente (answered_at y desempate por id)', () => {
    const filas = [
      fila({ item_number: 1, answer: 'siempre', answered_at: '2026-07-11T10:00:00Z' }),
      fila({ item_number: 1, answer: 'nunca', answered_at: '2026-07-11T10:05:00Z' }),
      fila({ item_number: 2, answer: 'casi_nunca', answered_at: '2026-07-11T10:01:00Z' }),
      // mismo answered_at: desempata el id mayor (insertado después)
      fila({
        item_number: 3,
        answer: 'siempre',
        answered_at: '2026-07-11T10:02:00Z',
        id: '00000000-0000-4000-8000-000000000001',
      }),
      fila({
        item_number: 3,
        answer: 'algunas_veces',
        answered_at: '2026-07-11T10:02:00Z',
        id: '00000000-0000-4000-8000-000000000002',
      }),
    ];
    const vigentes = ultimaRespuestaPorItem(filas);
    expect(vigentes.get('1')?.answer).toBe('nunca');
    expect(vigentes.get('2')?.answer).toBe('casi_nunca');
    expect(vigentes.get('3')?.answer).toBe('algunas_veces');
  });

  it('distingue ítems de secciones distintas (GR-I)', () => {
    const filas = [
      fila({ item_number: 1, section: 'I', answer: 'si' }),
      fila({ item_number: 1, section: 'II', answer: 'no' }),
    ];
    const vigentes = ultimaRespuestaPorItem(filas);
    expect(vigentes.get('I:1')?.answer).toBe('si');
    expect(vigentes.get('II:1')?.answer).toBe('no');
  });
});

describe('construirEntradaLikert', () => {
  const completas = (puntaje: string): FilaRespuesta[] =>
    Array.from({ length: 72 }, (_, i) => fila({ item_number: i + 1, answer: puntaje }));

  it('construye la entrada del motor con las respuestas vigentes', () => {
    const entrada = construirEntradaLikert(completas('nunca'), GR3, {
      atiendeClientes: true,
      supervisaPersonal: true,
    });
    expect(Object.keys(entrada.respuestas)).toHaveLength(72);
    expect(entrada.respuestas[1]).toBe('nunca');
    expect(entrada.atiendeClientes).toBe(true);
  });

  it('descarta respuestas de condicionales que no aplican según los filtros', () => {
    const entrada = construirEntradaLikert(completas('nunca'), GR3, {
      atiendeClientes: false,
      supervisaPersonal: false,
    });
    expect(entrada.respuestas[64]).toBe('nunca');
    expect(entrada.respuestas[65]).toBeUndefined();
    expect(entrada.respuestas[72]).toBeUndefined();
  });

  it('rechaza respuestas que no son opciones Likert', () => {
    const filas = [fila({ item_number: 1, answer: 'si' })];
    expect(() =>
      construirEntradaLikert(filas, GR3, { atiendeClientes: true, supervisaPersonal: true }),
    ).toThrow(/1/);
  });
});

describe('construirEntradaGR1', () => {
  const CONTEOS = { I: 6, II: 2, III: 7, IV: 5 };
  const seccion = (s: 'I' | 'II' | 'III' | 'IV', respuestas: string[]): FilaRespuesta[] =>
    respuestas.map((answer, i) => fila({ section: s, item_number: i + 1, answer }));

  it('sin acontecimiento: solo Sección I completa', () => {
    const entrada = construirEntradaGR1(seccion('I', Array(6).fill('no')), CONTEOS);
    expect(entrada.seccionI).toEqual([false, false, false, false, false, false]);
    expect(entrada.seccionII).toBeUndefined();
  });

  it('con acontecimiento: arma las cuatro secciones en orden de ítem', () => {
    const filas = [
      ...seccion('I', ['si', 'no', 'no', 'no', 'no', 'no']),
      ...seccion('II', ['no', 'si']),
      ...seccion('III', Array(7).fill('no')),
      ...seccion('IV', ['si', 'si', 'no', 'no', 'no']),
    ];
    const entrada = construirEntradaGR1(filas, CONTEOS);
    expect(entrada.seccionI).toEqual([true, false, false, false, false, false]);
    expect(entrada.seccionII).toEqual([false, true]);
    expect(entrada.seccionIV).toEqual([true, true, false, false, false]);
  });

  it('rechaza una sección incompleta indicando los ítems faltantes', () => {
    const filas = [
      ...seccion('I', ['si', 'no', 'no', 'no', 'no', 'no']),
      ...seccion('II', ['no']), // falta el ítem 2
      ...seccion('III', Array(7).fill('no')),
      ...seccion('IV', Array(5).fill('no')),
    ];
    expect(() => construirEntradaGR1(filas, CONTEOS)).toThrow(/II.*2/);
  });

  it('rechaza respuestas que no son si/no', () => {
    const filas = seccion('I', ['siempre', 'no', 'no', 'no', 'no', 'no']);
    expect(() => construirEntradaGR1(filas, CONTEOS)).toThrow(/I.*1/);
  });
});
