import { describe, expect, it } from 'vitest';
import { puedeDeshabilitarOperador, transicionOperadorValida } from './operadores';

// Transiciones del ciclo de vida de operadores (spec §1.1–§1.2): invited → active →
// disabled. `disabled` es la baja — nunca DELETE. No hay retorno de disabled (si alguien
// vuelve, se le invita de nuevo con cuenta nueva y queda en la bitácora).

describe('transicionOperadorValida', () => {
  it.each([
    ['invited', 'active', true], // activación (contraseña + TOTP verificado)
    ['active', 'disabled', true], // baja
    ['invited', 'disabled', true], // cancelar una invitación
    ['disabled', 'active', false], // sin resurrección silenciosa
    ['disabled', 'invited', false],
    ['active', 'invited', false],
    ['invited', 'invited', false],
    ['active', 'active', false],
  ] as const)('%s → %s: %s', (de, a, esperado) => {
    expect(transicionOperadorValida(de, a)).toBe(esperado);
  });
});

describe('puedeDeshabilitarOperador', () => {
  const OPS = [
    { id: 'op-1', status: 'active' as const },
    { id: 'op-2', status: 'active' as const },
    { id: 'op-3', status: 'invited' as const },
    { id: 'op-4', status: 'disabled' as const },
  ];

  it('deshabilitar un activo cuando hay otro activo: permitido', () => {
    expect(puedeDeshabilitarOperador(OPS, 'op-1')).toEqual({ ok: true });
  });

  it('deshabilitar una invitación pendiente: permitido (no toca el conteo de activos)', () => {
    expect(puedeDeshabilitarOperador(OPS, 'op-3')).toEqual({ ok: true });
  });

  it('el ÚLTIMO operador activo no puede deshabilitarse (la plataforma quedaría sin operación)', () => {
    const soloUno = [
      { id: 'op-1', status: 'active' as const },
      { id: 'op-3', status: 'invited' as const },
    ];
    const r = puedeDeshabilitarOperador(soloUno, 'op-1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/último/i);
  });

  it('objetivo inexistente o ya deshabilitado: rechazado', () => {
    expect(puedeDeshabilitarOperador(OPS, 'no-existe').ok).toBe(false);
    expect(puedeDeshabilitarOperador(OPS, 'op-4').ok).toBe(false);
  });
});
