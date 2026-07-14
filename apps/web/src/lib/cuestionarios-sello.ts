import { createHash } from 'node:crypto';
import type { DefinicionCuestionario } from './cuestionarios';

// Sellado sha256 de la definición (SOLO servidor: node:crypto no existe en el
// navegador; el resto del dominio en lib/cuestionarios.ts es isomorfo porque lo
// consumen el editor y el renderizador cliente).

function ordenarClaves(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarClaves);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.keys(valor as Record<string, unknown>)
        .sort()
        .map((k) => [k, ordenarClaves((valor as Record<string, unknown>)[k])]),
    );
  }
  return valor;
}

/**
 * Sello genérico de un valor JSON: serialización canónica (claves ordenadas
 * recursivamente) → sha256 hex. Mismo criterio para todo lo que se sella en la
 * plataforma (definiciones publicadas, constancias de difusión, instrumentos del
 * expediente): el sello es reproducible sin importar el orden de inserción.
 */
export function selloCanonico(valor: unknown): { json: string; sha256: string } {
  const json = JSON.stringify(ordenarClaves(valor));
  return { json, sha256: createHash('sha256').update(json).digest('hex') };
}

/** Sello de la definición al publicar: JSON canónico (claves ordenadas) → sha256. */
export function sha256DeDefinicion(def: DefinicionCuestionario): string {
  return selloCanonico(def).sha256;
}
