import { randomBytes } from 'node:crypto';

// Buzón de quejas y denuncias (NOM-035 8.1 b). Lógica pura: folio y clave de
// seguimiento + validación del envío. El folio es público (identifica la queja);
// la clave es el secreto de consulta y SOLO su hash toca la BD (lib/tokens.ts).

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

export const CATEGORIAS_QUEJA = {
  violencia_laboral: 'Actos de violencia laboral (malos tratos, acoso, hostigamiento)',
  practicas_opuestas_eof: 'Prácticas que dañan el ambiente de trabajo',
} as const;

export type CategoriaQueja = keyof typeof CATEGORIAS_QUEJA;

export const ESTADOS_QUEJA = {
  recibida: 'Recibida',
  en_revision: 'En revisión',
  atendida: 'Atendida',
  cerrada: 'Cerrada',
} as const;

export type EstadoQueja = keyof typeof ESTADOS_QUEJA;

export const TEXTO_QUEJA_MIN = 20;
export const TEXTO_QUEJA_MAX = 5000;

export interface DatosQueja {
  categoria: string;
  texto: string;
  /** null = el trabajador aún no elige; la identidad es una decisión EXPLÍCITA. */
  anonimo: boolean | null;
  nombre: string;
  contacto: string;
}

export type ResultadoValidacion = { ok: true } | { ok: false; error: string };

export function validarQueja(datos: DatosQueja): ResultadoValidacion {
  if (!(datos.categoria in CATEGORIAS_QUEJA)) {
    return { ok: false, error: 'Elige el tipo de reporte.' };
  }
  const texto = datos.texto.trim();
  if (texto.length < TEXTO_QUEJA_MIN) {
    return {
      ok: false,
      error: `Cuéntanos qué pasó con un poco más de detalle (mínimo ${TEXTO_QUEJA_MIN} caracteres).`,
    };
  }
  if (texto.length > TEXTO_QUEJA_MAX) {
    return { ok: false, error: `El texto no puede exceder ${TEXTO_QUEJA_MAX} caracteres.` };
  }
  if (datos.anonimo === null) {
    return { ok: false, error: 'Elige si quieres identificarte o reportar de forma anónima.' };
  }
  if (!datos.anonimo && datos.nombre.trim().length === 0) {
    return { ok: false, error: 'Si decides identificarte, escribe tu nombre.' };
  }
  return { ok: true };
}
