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

/** Sello de la definición al publicar: JSON canónico (claves ordenadas) → sha256. */
export function sha256DeDefinicion(def: DefinicionCuestionario): string {
  return createHash('sha256')
    .update(JSON.stringify(ordenarClaves(def)))
    .digest('hex');
}
