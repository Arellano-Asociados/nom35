/**
 * Validación de archivos subidos (auditoría v0: NO había ninguna).
 *
 * Antes solo se comprobaba `size === 0`. Sin tipo MIME verificado en servidor, sin magic
 * bytes, sin límite de tamaño y con el `contentType` dictado por el cliente, un admin —o
 * un consultor infiltrado— podía subir un .html o .svg declarándolo `text/html`. Ese
 * archivo se entrega A LOS TRABAJADORES por URL firmada desde el dominio de Supabase:
 * XSS almacenado / phishing con una URL legítima, dirigido a las personas justo cuando
 * están entregando datos de salud.
 *
 * Reglas: solo PDF, verificado por magic bytes (no por lo que diga el cliente), máximo
 * 10 MB, y el nombre del objeto lo genera el servidor (nunca se deriva del input).
 */

export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024;

const MAGIC_PDF = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

export interface ArchivoValidado {
  bytes: Buffer;
  /** Tipo forzado por el servidor, jamás el declarado por el cliente. */
  contentType: 'application/pdf';
  extension: '.pdf';
}

export type ResultadoValidacion =
  { ok: true; archivo: ArchivoValidado } | { ok: false; error: string };

export async function validarPdf(archivo: File): Promise<ResultadoValidacion> {
  if (archivo.size === 0) {
    return { ok: false, error: 'El archivo está vacío. Elige un PDF válido.' };
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    return {
      ok: false,
      error: 'El archivo pesa más de 10 MB. Comprímelo o divídelo antes de subirlo.',
    };
  }

  const bytes = Buffer.from(await archivo.arrayBuffer());

  // La verdad la dan los bytes, no la extensión ni el Content-Type que manda el cliente.
  const esPdf = MAGIC_PDF.every((b, i) => bytes[i] === b);
  if (!esPdf) {
    return {
      ok: false,
      error: 'El archivo no es un PDF. Solo se aceptan documentos en formato PDF.',
    };
  }

  return {
    ok: true,
    archivo: { bytes, contentType: 'application/pdf', extension: '.pdf' },
  };
}

/**
 * Nombre del objeto en Storage, generado por el servidor. Nunca se concatena el nombre
 * que trae el archivo: eso rompía la invariante "todo objeto de la empresa X vive bajo
 * el prefijo X/" (un nombre como `../otra/ruta.pdf` producía una clave fuera del prefijo).
 */
export function rutaDeObjeto(companyId: string, extension: string): string {
  return `${companyId}/${crypto.randomUUID()}${extension}`;
}
