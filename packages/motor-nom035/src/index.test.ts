import { describe, expect, it } from 'vitest';
import {
  calificarCuestionario,
  evaluarGR1,
  GR2,
  GR3,
  MOTOR_NOM035_VERSION,
  nivelDeRiesgo,
  REGLAS_GR1,
} from './index';

describe('API pública del motor', () => {
  it('exporta las funciones y datos normativos', () => {
    expect(MOTOR_NOM035_VERSION).toBe('0.1.0');
    expect(typeof calificarCuestionario).toBe('function');
    expect(typeof evaluarGR1).toBe('function');
    expect(typeof nivelDeRiesgo).toBe('function');
    expect(GR2.guia).toBe('GR-II');
    expect(GR3.guia).toBe('GR-III');
    expect(REGLAS_GR1.minSiSeccionII).toBe(1);
  });
});
