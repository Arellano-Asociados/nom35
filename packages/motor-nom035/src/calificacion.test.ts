import { describe, expect, it } from 'vitest';
import { calificarCuestionario } from './calificacion';
import { GR2, GR3 } from './datos';
import type {
  DefinicionGuia,
  GrupoCalificacion,
  OpcionLikert,
  RespuestasCuestionario,
} from './tipos';

// ——— Helpers de construcción de respuestas ———

const OPCIONES: readonly OpcionLikert[] = [
  'siempre',
  'casi_siempre',
  'algunas_veces',
  'casi_nunca',
  'nunca',
];

/** Opción que vale `puntaje` (0–4) para un ítem del grupo dado. */
function opcionConPuntaje(grupo: GrupoCalificacion, puntaje: number): OpcionLikert {
  const indice = grupo === 'A' ? puntaje : 4 - puntaje;
  const opcion = OPCIONES[indice];
  if (opcion === undefined) throw new Error(`Puntaje fuera de rango: ${puntaje}`);
  return opcion;
}

/** Respuestas completas donde cada ítem vale exactamente `puntajePorItem`. */
function respuestasUniformes(guia: DefinicionGuia, puntajePorItem: number): RespuestasCuestionario {
  const respuestas: Record<number, OpcionLikert> = {};
  for (let item = 1; item <= guia.totalItems; item++) {
    const grupo = guia.grupoDeItem[item];
    if (!grupo) throw new Error(`Ítem sin grupo: ${item}`);
    respuestas[item] = opcionConPuntaje(grupo, puntajePorItem);
  }
  return { respuestas, atiendeClientes: true, supervisaPersonal: true };
}

/** Respuestas completas cuya suma total es exactamente `objetivo` (reparto voraz de 0–4 por ítem). */
function respuestasConCfinal(guia: DefinicionGuia, objetivo: number): RespuestasCuestionario {
  if (objetivo > guia.totalItems * 4) throw new Error(`Objetivo inalcanzable: ${objetivo}`);
  const respuestas: Record<number, OpcionLikert> = {};
  let restante = objetivo;
  for (let item = 1; item <= guia.totalItems; item++) {
    const grupo = guia.grupoDeItem[item];
    if (!grupo) throw new Error(`Ítem sin grupo: ${item}`);
    const puntos = Math.min(4, restante);
    restante -= puntos;
    respuestas[item] = opcionConPuntaje(grupo, puntos);
  }
  return { respuestas, atiendeClientes: true, supervisaPersonal: true };
}

// ——— Caso 1 y 2: extremos GR-III ———

describe('GR-III: extremos', () => {
  it('caso 1: todo mínimo → Cfinal=0 y nivel nulo en Cfinal, categorías y dominios', () => {
    const resultado = calificarCuestionario(respuestasUniformes(GR3, 0), GR3);
    expect(resultado.cfinal).toBe(0);
    expect(resultado.nivelFinal).toBe('nulo');
    for (const categoria of resultado.categorias) {
      expect(categoria.puntaje, categoria.nombre).toBe(0);
      expect(categoria.nivel, categoria.nombre).toBe('nulo');
    }
    for (const dominio of resultado.dominios) {
      expect(dominio.puntaje, dominio.nombre).toBe(0);
      expect(dominio.nivel, dominio.nombre).toBe('nulo');
    }
  });

  it('caso 2: todo máximo → Cfinal=288 y nivel muy_alto en todos los niveles', () => {
    const resultado = calificarCuestionario(respuestasUniformes(GR3, 4), GR3);
    expect(resultado.cfinal).toBe(288);
    expect(resultado.nivelFinal).toBe('muy_alto');
    for (const categoria of resultado.categorias) {
      expect(categoria.nivel, categoria.nombre).toBe('muy_alto');
    }
    for (const dominio of resultado.dominios) {
      expect(dominio.nivel, dominio.nombre).toBe('muy_alto');
    }
  });
});

// ——— Caso 3: límites exactos de Cfinal GR-III ———

describe('GR-III: límites exactos de Cfinal (caso 3)', () => {
  it.each([
    [49, 'nulo'],
    [50, 'bajo'],
    [74, 'bajo'],
    [75, 'medio'],
    [98, 'medio'],
    [99, 'alto'],
    [139, 'alto'],
    [140, 'muy_alto'],
  ] as const)('Cfinal=%i → %s', (objetivo, nivelEsperado) => {
    const resultado = calificarCuestionario(respuestasConCfinal(GR3, objetivo), GR3);
    expect(resultado.cfinal).toBe(objetivo);
    expect(resultado.nivelFinal).toBe(nivelEsperado);
  });
});

// ——— Caso 4: la inversión de grupo es efectiva ———

describe('GR-III: calificación directa vs. inversa (caso 4)', () => {
  it('todas "siempre" puntúa solo los 37 ítems del grupo B → Cfinal=148', () => {
    const respuestas: Record<number, OpcionLikert> = {};
    for (let item = 1; item <= 72; item++) respuestas[item] = 'siempre';
    const resultado = calificarCuestionario(
      { respuestas, atiendeClientes: true, supervisaPersonal: true },
      GR3,
    );
    expect(resultado.cfinal).toBe(37 * 4);
  });

  it('todas "nunca" puntúa solo los 35 ítems del grupo A → Cfinal=140', () => {
    const respuestas: Record<number, OpcionLikert> = {};
    for (let item = 1; item <= 72; item++) respuestas[item] = 'nunca';
    const resultado = calificarCuestionario(
      { respuestas, atiendeClientes: true, supervisaPersonal: true },
      GR3,
    );
    expect(resultado.cfinal).toBe(35 * 4);
  });

  it('invertir la respuesta de un solo ítem cambia el resultado en la dirección de su grupo', () => {
    const base = respuestasUniformes(GR3, 0);
    // Ítem 1 es grupo A: pasar de "siempre" (0) a "nunca" (4) debe sumar 4
    const conItemA = {
      ...base,
      respuestas: { ...base.respuestas, 1: 'nunca' as const },
    };
    expect(calificarCuestionario(conItemA, GR3).cfinal).toBe(4);
    // Ítem 2 es grupo B: pasar de "nunca" (0) a "siempre" (4) debe sumar 4
    const conItemB = {
      ...base,
      respuestas: { ...base.respuestas, 2: 'siempre' as const },
    };
    expect(calificarCuestionario(conItemB, GR3).cfinal).toBe(4);
  });
});

// ——— Casos 5 y 6: extremos GR-II ———

describe('GR-II: extremos', () => {
  it('caso 5: todo mínimo → Cfinal=0, nivel nulo en todos los niveles', () => {
    const resultado = calificarCuestionario(respuestasUniformes(GR2, 0), GR2);
    expect(resultado.cfinal).toBe(0);
    expect(resultado.nivelFinal).toBe('nulo');
    for (const puntuado of [...resultado.categorias, ...resultado.dominios]) {
      expect(puntuado.puntaje, puntuado.nombre).toBe(0);
      expect(puntuado.nivel, puntuado.nombre).toBe('nulo');
    }
  });

  it('caso 6: todo máximo → Cfinal=184, nivel muy_alto en todos los niveles', () => {
    const resultado = calificarCuestionario(respuestasUniformes(GR2, 4), GR2);
    expect(resultado.cfinal).toBe(46 * 4);
    expect(resultado.nivelFinal).toBe('muy_alto');
    for (const puntuado of [...resultado.categorias, ...resultado.dominios]) {
      expect(puntuado.nivel, puntuado.nombre).toBe('muy_alto');
    }
  });

  it('límites exactos de Cfinal GR-II: <20/<45/<70/<90/≥90', () => {
    const casos = [
      [19, 'nulo'],
      [20, 'bajo'],
      [44, 'bajo'],
      [45, 'medio'],
      [69, 'medio'],
      [70, 'alto'],
      [89, 'alto'],
      [90, 'muy_alto'],
    ] as const;
    for (const [objetivo, nivelEsperado] of casos) {
      const resultado = calificarCuestionario(respuestasConCfinal(GR2, objetivo), GR2);
      expect(resultado.cfinal, `objetivo ${objetivo}`).toBe(objetivo);
      expect(resultado.nivelFinal, `objetivo ${objetivo}`).toBe(nivelEsperado);
    }
  });
});

// ——— Caso 9: validación de completitud ———

describe('validación de completitud (caso 9)', () => {
  it('GR-III: rechaza un cuestionario al que le falta un ítem obligatorio', () => {
    const completas = respuestasUniformes(GR3, 0);
    const respuestas = { ...completas.respuestas };
    delete respuestas[10];
    expect(() => calificarCuestionario({ ...completas, respuestas }, GR3)).toThrow(/10/);
  });

  it('GR-II: rechaza un cuestionario al que le falta un ítem obligatorio', () => {
    const completas = respuestasUniformes(GR2, 0);
    const respuestas = { ...completas.respuestas };
    delete respuestas[5];
    expect(() => calificarCuestionario({ ...completas, respuestas }, GR2)).toThrow(/5/);
  });

  it('rechaza un cuestionario vacío', () => {
    expect(() =>
      calificarCuestionario(
        { respuestas: {}, atiendeClientes: false, supervisaPersonal: false },
        GR3,
      ),
    ).toThrow(/incompleto/i);
  });

  it('rechaza ítems desconocidos (fuera de 1–totalItems)', () => {
    const completas = respuestasUniformes(GR3, 0);
    const respuestas = { ...completas.respuestas, 73: 'nunca' as const };
    expect(() => calificarCuestionario({ ...completas, respuestas }, GR3)).toThrow(/73/);
  });

  it('GR-III: si atiende clientes, los ítems 65–68 son obligatorios', () => {
    const completas = respuestasUniformes(GR3, 0);
    const respuestas = { ...completas.respuestas };
    delete respuestas[65];
    expect(() =>
      calificarCuestionario({ ...completas, respuestas, atiendeClientes: true }, GR3),
    ).toThrow(/65/);
  });
});

// ——— Caso 10: ítems condicionales ———

describe('ítems condicionales (caso 10)', () => {
  it('GR-III: los condicionales no aplicables se omiten y puntúan como "Nunca" (0)', () => {
    const completas = respuestasUniformes(GR3, 2); // todo en "algunas_veces" (2 puntos)
    const sinCondicionales = { ...completas.respuestas };
    for (const item of [65, 66, 67, 68, 69, 70, 71, 72]) delete sinCondicionales[item];

    const resultado = calificarCuestionario(
      { respuestas: sinCondicionales, atiendeClientes: false, supervisaPersonal: false },
      GR3,
    );
    // Equivalente a responder "nunca" (0 puntos, grupo B) en los 8 condicionales
    const explicitas = { ...completas.respuestas };
    for (const item of [65, 66, 67, 68, 69, 70, 71, 72]) explicitas[item] = 'nunca';
    const esperado = calificarCuestionario(
      { respuestas: explicitas, atiendeClientes: true, supervisaPersonal: true },
      GR3,
    );
    expect(resultado.cfinal).toBe(esperado.cfinal);
    expect(resultado.dominios).toEqual(esperado.dominios);
    expect(resultado.categorias).toEqual(esperado.categorias);
  });

  it('GR-III: rechaza respuestas a condicionales que no aplican', () => {
    const completas = respuestasUniformes(GR3, 0);
    // atiendeClientes=false pero el ítem 65 viene respondido
    expect(() => calificarCuestionario({ ...completas, atiendeClientes: false }, GR3)).toThrow(
      /65/,
    );
  });

  it('GR-III: condicionales mixtos (atiende clientes sí, supervisa no)', () => {
    const completas = respuestasUniformes(GR3, 1);
    const respuestas = { ...completas.respuestas };
    for (const item of [69, 70, 71, 72]) delete respuestas[item];
    const resultado = calificarCuestionario(
      { respuestas, atiendeClientes: true, supervisaPersonal: false },
      GR3,
    );
    // 68 ítems respondidos con 1 punto + 4 condicionales en 0
    expect(resultado.cfinal).toBe(68);
  });

  it('GR-II: condicionales 41–43 (clientes) y 44–46 (supervisión) omitidos puntúan 0', () => {
    const completas = respuestasUniformes(GR2, 1);
    const respuestas = { ...completas.respuestas };
    for (const item of [41, 42, 43, 44, 45, 46]) delete respuestas[item];
    const resultado = calificarCuestionario(
      { respuestas, atiendeClientes: false, supervisaPersonal: false },
      GR2,
    );
    expect(resultado.cfinal).toBe(40);
  });
});

// ——— Definiciones de guía malformadas ———

describe('definición de guía inválida', () => {
  it('rechaza una definición que no asigna grupo a algún ítem', () => {
    const grupoDeItem = { ...GR3.grupoDeItem };
    delete (grupoDeItem as Record<number, GrupoCalificacion>)[5];
    const guiaRota: DefinicionGuia = { ...GR3, grupoDeItem };
    expect(() => calificarCuestionario(respuestasUniformes(GR3, 0), guiaRota)).toThrow(/grupo/i);
  });
});

// ——— Estructura del resultado ———

describe('estructura del resultado', () => {
  it('reporta todas las categorías y dominios de la guía, en el orden de la definición', () => {
    const resultado = calificarCuestionario(respuestasUniformes(GR3, 0), GR3);
    expect(resultado.guia).toBe('GR-III');
    expect(resultado.categorias.map((c) => c.nombre)).toEqual(GR3.categorias.map((c) => c.nombre));
    expect(resultado.dominios.map((d) => d.nombre)).toEqual(GR3.dominios.map((d) => d.nombre));
  });
});
