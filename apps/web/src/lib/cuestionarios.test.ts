import { describe, expect, it } from 'vitest';
import { seccionesVisibles, validarDefinicion, type DefinicionCuestionario } from './cuestionarios';
import { sha256DeDefinicion } from './cuestionarios-sello';

const DEF: DefinicionCuestionario = {
  secciones: [
    {
      id: 's1',
      titulo: 'Clima general',
      preguntas: [
        { id: 'p1', texto: '¿Cómo calificas tu semana?', tipo: 'likert5' },
        { id: 'p2', texto: '¿Trabajas en remoto?', tipo: 'si_no' },
      ],
    },
    {
      id: 's2',
      titulo: 'Remoto',
      condicion: { preguntaId: 'p2', valor: 'si' },
      preguntas: [
        {
          id: 'p3',
          texto: '¿Qué herramienta usas más?',
          tipo: 'opcion_multiple',
          opciones: ['Correo', 'Chat', 'Videollamada'],
        },
        { id: 'p4', texto: 'Cuéntanos más', tipo: 'abierta' },
      ],
    },
  ],
};

describe('validarDefinicion', () => {
  it('acepta una definición completa y coherente', () => {
    expect(validarDefinicion(DEF)).toEqual({ ok: true });
  });

  it('rechaza sin secciones o sin preguntas', () => {
    const r1 = validarDefinicion({ secciones: [] });
    expect(r1.ok).toBe(false);
    const r2 = validarDefinicion({
      secciones: [{ id: 's1', titulo: 'Vacía', preguntas: [] }],
    });
    expect(r2.ok).toBe(false);
  });

  it('rechaza textos vacíos y opción múltiple con menos de 2 opciones', () => {
    const r = validarDefinicion({
      secciones: [
        {
          id: 's1',
          titulo: '',
          preguntas: [{ id: 'p1', texto: '', tipo: 'opcion_multiple', opciones: ['solo una'] }],
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.length).toBeGreaterThanOrEqual(3);
  });

  it('rechaza una condición que apunta a una pregunta inexistente o de sección posterior', () => {
    const r = validarDefinicion({
      secciones: [
        {
          id: 's1',
          titulo: 'A',
          condicion: { preguntaId: 'p9', valor: 'si' },
          preguntas: [{ id: 'p1', texto: 'X', tipo: 'si_no' }],
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it('rechaza ids duplicados de pregunta', () => {
    const r = validarDefinicion({
      secciones: [
        {
          id: 's1',
          titulo: 'A',
          preguntas: [
            { id: 'p1', texto: 'X', tipo: 'si_no' },
            { id: 'p1', texto: 'Y', tipo: 'si_no' },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
  });
});

describe('seccionesVisibles (lógica condicional)', () => {
  it('oculta la sección condicionada hasta que la respuesta coincide', () => {
    expect(seccionesVisibles(DEF, {}).map((s) => s.id)).toEqual(['s1']);
    expect(seccionesVisibles(DEF, { p2: 'no' }).map((s) => s.id)).toEqual(['s1']);
    expect(seccionesVisibles(DEF, { p2: 'si' }).map((s) => s.id)).toEqual(['s1', 's2']);
  });
});

describe('sha256DeDefinicion (sellado al publicar)', () => {
  it('es estable ante el orden de las claves del objeto', () => {
    const a = sha256DeDefinicion(DEF);
    const clonDesordenado = JSON.parse(JSON.stringify(DEF)) as DefinicionCuestionario;
    // Reconstruye una pregunta con las claves en otro orden
    clonDesordenado.secciones[0].preguntas[0] = JSON.parse(
      '{"tipo":"likert5","id":"p1","texto":"¿Cómo calificas tu semana?"}',
    );
    expect(sha256DeDefinicion(clonDesordenado)).toBe(a);
  });

  it('cambia si cambia cualquier contenido', () => {
    const b = JSON.parse(JSON.stringify(DEF)) as DefinicionCuestionario;
    b.secciones[0].preguntas[0].texto = 'Otro texto';
    expect(sha256DeDefinicion(b)).not.toBe(sha256DeDefinicion(DEF));
  });
});
