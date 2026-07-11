import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calificarCuestionario } from './calificacion';
import { GR2, GR3 } from './datos';
import { evaluarGR1 } from './gr1';
import type { NivelRiesgo, OpcionLikert } from './tipos';

// Casos de referencia resueltos y validados por un consultor certificado NOM-035.
// DEPENDENCIA EXTERNA ABIERTA: aún no disponibles (ver CLAUDE.md). Formato documentado en
// reference-cases/README.md. Criterio de lanzamiento: coincidencia 100%.
//
// En modo release (NOM035_RELEASE=1) la ausencia de casos FALLA la suite: no se puede
// lanzar sin la validación del consultor.

interface CasoReferencia {
  descripcion: string;
  guia: 'GR-I' | 'GR-II' | 'GR-III';
  atiendeClientes?: boolean;
  supervisaPersonal?: boolean;
  respuestas?: Record<string, OpcionLikert>;
  secciones?: { I: boolean[]; II?: boolean[]; III?: boolean[]; IV?: boolean[] };
  esperado: {
    cfinal?: number;
    nivelFinal?: NivelRiesgo;
    categorias?: Record<string, { puntaje: number; nivel: NivelRiesgo }>;
    dominios?: Record<string, { puntaje: number; nivel: NivelRiesgo }>;
    requiereValoracionClinica?: boolean;
  };
}

const directorio = fileURLToPath(new URL('../reference-cases', import.meta.url));
const archivos = readdirSync(directorio).filter((nombre) => nombre.endsWith('.json'));
const modoRelease = process.env.NOM035_RELEASE === '1';

describe('casos de referencia del consultor certificado', () => {
  if (archivos.length === 0) {
    if (modoRelease) {
      it('GATE DE LANZAMIENTO: existen casos de referencia validados por consultor', () => {
        expect.fail(
          'reference-cases/ está vacío: no se puede lanzar sin los 3–5 cuestionarios ' +
            'resueltos y validados por un consultor certificado NOM-035 (ver CLAUDE.md)',
        );
      });
    } else {
      it.todo(
        'pendiente de datos del consultor certificado: cargar los casos JSON en reference-cases/ ' +
          '(la validación es obligatoria en modo release: NOM035_RELEASE=1)',
      );
    }
    return;
  }

  it.each(archivos)('%s coincide al 100%% con el motor', (archivo) => {
    const caso = JSON.parse(readFileSync(join(directorio, archivo), 'utf-8')) as CasoReferencia;

    if (caso.guia === 'GR-I') {
      if (!caso.secciones) throw new Error(`${archivo}: falta "secciones" para GR-I`);
      const resultado = evaluarGR1({
        seccionI: caso.secciones.I,
        ...(caso.secciones.II ? { seccionII: caso.secciones.II } : {}),
        ...(caso.secciones.III ? { seccionIII: caso.secciones.III } : {}),
        ...(caso.secciones.IV ? { seccionIV: caso.secciones.IV } : {}),
      });
      expect(resultado.requiereValoracionClinica).toBe(caso.esperado.requiereValoracionClinica);
      return;
    }

    const guia = caso.guia === 'GR-II' ? GR2 : GR3;
    if (!caso.respuestas) throw new Error(`${archivo}: falta "respuestas"`);
    const respuestas: Record<number, OpcionLikert> = {};
    for (const [item, opcion] of Object.entries(caso.respuestas)) {
      respuestas[Number(item)] = opcion;
    }
    const resultado = calificarCuestionario(
      {
        respuestas,
        atiendeClientes: caso.atiendeClientes ?? false,
        supervisaPersonal: caso.supervisaPersonal ?? false,
      },
      guia,
    );

    expect(resultado.cfinal).toBe(caso.esperado.cfinal);
    expect(resultado.nivelFinal).toBe(caso.esperado.nivelFinal);
    for (const [nombre, esperado] of Object.entries(caso.esperado.categorias ?? {})) {
      const categoria = resultado.categorias.find((c) => c.nombre === nombre);
      expect(categoria, `categoría ${nombre}`).toMatchObject(esperado);
    }
    for (const [nombre, esperado] of Object.entries(caso.esperado.dominios ?? {})) {
      const dominio = resultado.dominios.find((d) => d.nombre === nombre);
      expect(dominio, `dominio ${nombre}`).toMatchObject(esperado);
    }
  });
});
