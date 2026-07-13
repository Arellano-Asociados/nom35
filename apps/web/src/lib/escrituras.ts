import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Guardas de escritura (corrección de la auditoría v0).
 *
 * El patrón `await supabase.from(x).insert(...)` sin revisar `{ error }` hacía que una
 * escritura fallida pasara por exitosa. En este producto eso no es un bug cosmético:
 * las escrituras SON la evidencia que se exhibe ante la STPS. Un acuse de política que
 * no se guardó, pero que le dijo "listo" al trabajador, es evidencia perdida en
 * silencio — exactamente lo que el producto promete que no puede pasar.
 *
 * Regla: toda mutación pasa por una de estas dos guardas.
 * - `exigirEscritura`: LANZA si la escritura falló. Úsala cuando el fallo debe romper
 *   el flujo (la acción no puede reportar éxito sobre una escritura que no ocurrió).
 * - `escrituraOk`: devuelve false en vez de lanzar, para acciones que ya tienen su
 *   propio contrato `{ok:false, error}` y prefieren traducir el fallo a un mensaje.
 *
 * Ninguna de las dos filtra el mensaje crudo de Postgres al usuario: se registra en el
 * log del servidor y se devuelve un texto en es-MX apto para personal de RH.
 */

export class ErrorDeEscritura extends Error {
  constructor(
    readonly operacion: string,
    readonly causa: PostgrestError,
  ) {
    super(`No se pudo completar la operación "${operacion}": ${causa.message}`);
    this.name = 'ErrorDeEscritura';
  }
}

/** Resultado crudo de una mutación de supabase-js (insert/update/upsert/delete). */
export interface ResultadoEscritura<T> {
  data: T | null;
  error: PostgrestError | null;
}

/**
 * Lanza `ErrorDeEscritura` si la mutación falló; si no, devuelve su `data`.
 * `operacion` es una etiqueta legible para el log y para el mensaje de error.
 */
export async function exigirEscritura<T>(
  operacion: string,
  promesa: PromiseLike<ResultadoEscritura<T>>,
): Promise<T | null> {
  const { data, error } = await promesa;
  if (error) {
    // eslint-disable-next-line no-console -- error de infraestructura, sin datos personales
    console.error(`Escritura fallida (${operacion}):`, error.message, error.code);
    throw new ErrorDeEscritura(operacion, error);
  }
  return data;
}

/**
 * Variante no-lanzante para acciones con contrato `{ok:false, error}`: devuelve
 * `{ ok: false }` si la mutación falló, sin propagar el mensaje crudo de Postgres.
 */
export async function escrituraOk<T>(
  operacion: string,
  promesa: PromiseLike<ResultadoEscritura<T>>,
): Promise<{ ok: true; data: T | null } | { ok: false }> {
  const { data, error } = await promesa;
  if (error) {
    // eslint-disable-next-line no-console -- error de infraestructura, sin datos personales
    console.error(`Escritura fallida (${operacion}):`, error.message, error.code);
    return { ok: false };
  }
  return { ok: true, data };
}
