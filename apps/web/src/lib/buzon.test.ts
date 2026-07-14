import { describe, expect, it } from 'vitest';
import { generarClave, generarFolio, validarQueja } from './buzon';

// Buzón de quejas (NOM-035 8.1 b): folio y clave de seguimiento sin ambigüedad
// tipográfica (se dictan por teléfono o se copian de un papel) y validación del
// envío con elección EXPLÍCITA de identidad (anónimo no es un default silencioso).

const ALFABETO = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]+$/;

describe('generarFolio', () => {
  it('tiene el formato QJ- + 8 caracteres sin ambigüedad (sin 0/O/1/I/L)', () => {
    const folio = generarFolio();
    expect(folio).toMatch(/^QJ-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  });

  it('dos folios consecutivos no coinciden', () => {
    expect(generarFolio()).not.toBe(generarFolio());
  });
});

describe('generarClave', () => {
  it('produce 12 caracteres del mismo alfabeto', () => {
    const clave = generarClave();
    expect(clave).toHaveLength(12);
    expect(clave).toMatch(ALFABETO);
  });
});

describe('validarQueja', () => {
  const base = {
    categoria: 'violencia_laboral',
    texto: 'Descripción suficientemente larga de los hechos ocurridos.',
    anonimo: true as boolean | null,
    nombre: '',
    contacto: '',
  };

  it('acepta una queja anónima válida', () => {
    expect(validarQueja(base)).toEqual({ ok: true });
  });

  it('rechaza categoría desconocida', () => {
    expect(validarQueja({ ...base, categoria: 'otra' })).toMatchObject({ ok: false });
  });

  it('rechaza texto demasiado corto o demasiado largo', () => {
    expect(validarQueja({ ...base, texto: 'corto' })).toMatchObject({ ok: false });
    expect(validarQueja({ ...base, texto: 'x'.repeat(5001) })).toMatchObject({ ok: false });
  });

  it('exige la elección explícita de identidad (null = no eligió)', () => {
    expect(validarQueja({ ...base, anonimo: null })).toMatchObject({ ok: false });
  });

  it('si se identifica, el nombre es obligatorio', () => {
    expect(validarQueja({ ...base, anonimo: false, nombre: '' })).toMatchObject({ ok: false });
    expect(validarQueja({ ...base, anonimo: false, nombre: 'Ana Pérez' })).toEqual({ ok: true });
  });
});
