import { describe, expect, it } from 'vitest';
import { MOTOR_NOM035_VERSION } from './index';

// Test placeholder: valida que el paquete carga. La suite real (casos 1–11 del plan)
// se escribe con TDD en el Milestone 1.
describe('motor-nom035', () => {
  it('exporta la versión del motor', () => {
    expect(MOTOR_NOM035_VERSION).toBe('0.0.0');
  });
});
