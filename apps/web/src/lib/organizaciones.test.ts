import { describe, expect, it } from 'vitest';
import { transicionEmpresaValida } from './organizaciones';

// Transiciones de estado de organización (spec §2.1): active ↔ suspended;
// active|suspended → pending_deletion; pending_deletion → suspended (arrepentimiento
// dentro del plazo). La purga física NUNCA es una transición de estado: solo el script
// manual la ejecuta.

describe('transicionEmpresaValida', () => {
  it.each([
    ['active', 'suspended', true],
    ['suspended', 'active', true],
    ['active', 'pending_deletion', true],
    ['suspended', 'pending_deletion', true],
    ['pending_deletion', 'suspended', true], // arrepentimiento
    ['pending_deletion', 'active', false], // primero se revierte a suspended, luego se reactiva
    ['active', 'active', false],
    ['suspended', 'suspended', false],
    ['pending_deletion', 'pending_deletion', false],
  ] as const)('%s → %s: %s', (de, a, esperado) => {
    expect(transicionEmpresaValida(de, a)).toBe(esperado);
  });
});
