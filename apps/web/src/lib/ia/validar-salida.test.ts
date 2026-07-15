import { describe, expect, it } from 'vitest';
import { validarPlan, validarResumen } from './validar-salida';

// Validación estructural de la salida de la IA (spec §3): un texto que no cumple el
// formato jamás se persiste ni se muestra.

const RESUMEN_OK = `## Panorama general
Participó el 80% del centro; el panorama global es de riesgo medio.

## Focos de atención
El dominio "Carga de trabajo" presenta nivel alto reportable.

## Recomendación para la dirección
Priorizar la revisión de cargas en el área de producción.`;

describe('validarResumen', () => {
  it('acepta un resumen con las tres secciones', () => {
    expect(validarResumen(RESUMEN_OK)).toEqual({ ok: true });
  });

  it('rechaza si falta una sección', () => {
    const sinRecomendacion = RESUMEN_OK.replace(
      '## Recomendación para la dirección',
      '## Otra cosa',
    );
    const r = validarResumen(sinRecomendacion);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Recomendación/);
  });

  it('rechaza una respuesta demasiado corta (posible error del proveedor)', () => {
    expect(validarResumen('ok').ok).toBe(false);
  });

  it('rechaza una respuesta absurdamente larga', () => {
    expect(validarResumen('## Panorama general '.repeat(1000)).ok).toBe(false);
  });
});

describe('validarPlan', () => {
  const CATALOGO = [
    'Revisar la distribución de cargas de trabajo',
    'Establecer pausas activas durante la jornada',
  ];

  it('parsea medidas y marca las ancladas al catálogo', () => {
    const texto = `- [ancla: Revisar la distribución de cargas de trabajo] Redistribuir tareas en producción.
- [ancla: Establecer pausas activas durante la jornada] Programar pausas de 5 minutos cada 2 horas.`;
    const r = validarPlan(texto, CATALOGO);
    expect(r.ok).toBe(true);
    expect(r.medidas).toHaveLength(2);
    expect(r.medidas[0]?.sinAncla).toBe(false);
    expect(r.medidas[0]?.ancla).toBe('Revisar la distribución de cargas de trabajo');
  });

  it('marca sinAncla cuando la medida cita NINGUNA o un ancla fuera del catálogo', () => {
    const texto = `- [ancla: NINGUNA] Comprar sillas ergonómicas.
- [ancla: Acción inventada que no existe] Otra medida.`;
    const r = validarPlan(texto, CATALOGO);
    expect(r.ok).toBe(true);
    expect(r.medidas).toHaveLength(2);
    expect(r.medidas.every((m) => m.sinAncla)).toBe(true);
  });

  it('rechaza si no hay ninguna medida en el formato esperado', () => {
    const r = validarPlan('Aquí va un texto libre sin viñetas de medida.', CATALOGO);
    expect(r.ok).toBe(false);
    expect(r.medidas).toEqual([]);
  });
});
