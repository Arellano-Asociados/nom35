import { describe, expect, it } from 'vitest';
import { accionesPrePobladas, exigePrograma, type CriteriosTomaAcciones } from './programa';

// Programa de intervención (8.3/8.4): la obligación nace de los criterios de la
// Tabla 4/7 ("Programa de intervención para los niveles medio, alto y muy alto"),
// que viven como DATOS en system_config (regla inviolable 7). Estas funciones son
// puras: reciben los criterios, no los conocen.

const CRITERIOS: CriteriosTomaAcciones = {
  titulo: 'Criterios para la toma de acciones',
  fuente: 'Tabla 4 / Tabla 7',
  exigenPrograma: ['medio', 'alto', 'muy_alto'],
  niveles: {
    muy_alto: {
      criterio: 'texto muy alto',
      accionesSugeridas: [
        { descripcion: 'Evaluaciones específicas', nivel_accion: 'tercer_nivel' },
        { descripcion: 'Campaña de sensibilización', nivel_accion: 'segundo_nivel' },
        { descripcion: 'Revisar la política', nivel_accion: 'primer_nivel' },
      ],
    },
    alto: {
      criterio: 'texto alto',
      accionesSugeridas: [
        { descripcion: 'Campaña de sensibilización', nivel_accion: 'segundo_nivel' },
        { descripcion: 'Revisar la política', nivel_accion: 'primer_nivel' },
      ],
    },
    medio: {
      criterio: 'texto medio',
      accionesSugeridas: [{ descripcion: 'Revisar la política', nivel_accion: 'primer_nivel' }],
    },
    bajo: { criterio: 'texto bajo', accionesSugeridas: [] },
    nulo: { criterio: 'texto nulo', accionesSugeridas: [] },
  },
};

describe('exigePrograma', () => {
  it('bajo y nulo no exigen programa', () => {
    expect(exigePrograma(['nulo', 'bajo'], CRITERIOS)).toBe(false);
  });

  it('cualquier medio/alto/muy_alto lo exige', () => {
    expect(exigePrograma(['nulo', 'medio'], CRITERIOS)).toBe(true);
    expect(exigePrograma(['alto'], CRITERIOS)).toBe(true);
    expect(exigePrograma(['muy_alto'], CRITERIOS)).toBe(true);
  });

  it('sin niveles no exige nada', () => {
    expect(exigePrograma([], CRITERIOS)).toBe(false);
  });
});

describe('accionesPrePobladas', () => {
  it('deduplica por descripción quedándose con la del nivel más severo presente', () => {
    const acciones = accionesPrePobladas(['medio', 'muy_alto'], CRITERIOS);
    const descripciones = acciones.map((a) => a.descripcion);
    expect(descripciones).toEqual([
      'Evaluaciones específicas',
      'Campaña de sensibilización',
      'Revisar la política',
    ]);
    // "Revisar la política" existe en ambos niveles: sobrevive una sola
    expect(descripciones.filter((d) => d === 'Revisar la política')).toHaveLength(1);
    expect(acciones.every((a) => a.nivelOrigen === 'muy_alto' || a.nivelOrigen === 'medio')).toBe(
      true,
    );
  });

  it('solo toma niveles presentes', () => {
    const acciones = accionesPrePobladas(['medio'], CRITERIOS);
    expect(acciones).toEqual([
      { descripcion: 'Revisar la política', nivelAccion: 'primer_nivel', nivelOrigen: 'medio' },
    ]);
  });

  it('niveles que no exigen programa no aportan acciones; criterios vacíos no truenan', () => {
    expect(accionesPrePobladas(['bajo', 'nulo'], CRITERIOS)).toEqual([]);
    expect(
      accionesPrePobladas(['muy_alto'], {
        ...CRITERIOS,
        niveles: {},
      } as unknown as CriteriosTomaAcciones),
    ).toEqual([]);
  });
});
