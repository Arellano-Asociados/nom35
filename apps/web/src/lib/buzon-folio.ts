import { randomBytes } from 'node:crypto';

// Folio y clave de seguimiento del buzón (SOLO servidor: node:crypto no existe en
// el navegador; el dominio isomorfo del buzón vive en lib/buzon.ts porque lo
// consumen los componentes cliente). Mismo split que cuestionarios-sello.ts.

/** Sin 0/O/1/I/L: el folio se dicta por teléfono o se copia de un papel. */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function cadenaAleatoria(longitud: number): string {
  const bytes = randomBytes(longitud);
  let salida = '';
  for (let i = 0; i < longitud; i++) {
    salida += ALFABETO[(bytes[i] as number) % ALFABETO.length];
  }
  return salida;
}

export function generarFolio(): string {
  return `QJ-${cadenaAleatoria(8)}`;
}

export function generarClave(): string {
  return cadenaAleatoria(12);
}
