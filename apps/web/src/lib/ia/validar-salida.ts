// Validación ESTRUCTURAL de la salida de la IA (spec §3). Una respuesta que no cumple el
// formato se descarta con error genérico: jamás se persiste ni se muestra al usuario un
// texto que no pasó por aquí. Puro (sin I/O) — TDD.

const LARGO_MAXIMO = 6000;

const SECCIONES_RESUMEN = [
  '## Panorama general',
  '## Focos de atención',
  '## Recomendación para la dirección',
];

export interface ResultadoResumen {
  ok: boolean;
  error?: string;
}

export function validarResumen(texto: string): ResultadoResumen {
  if (texto.trim().length < 40) return { ok: false, error: 'Respuesta demasiado corta.' };
  if (texto.length > LARGO_MAXIMO) return { ok: false, error: 'Respuesta demasiado larga.' };
  const faltan = SECCIONES_RESUMEN.filter((s) => !texto.includes(s));
  if (faltan.length > 0) {
    return { ok: false, error: `Faltan secciones: ${faltan.join(', ')}` };
  }
  return { ok: true };
}

export interface MedidaPlan {
  /** Texto de la medida propuesta (sin el prefijo del ancla). */
  descripcion: string;
  /** Acción del catálogo citada como origen (vacío si NINGUNA). */
  ancla: string;
  /** true si la medida no ancla a ninguna acción del catálogo — la UI la señala. */
  sinAncla: boolean;
}

export interface ResultadoPlan {
  ok: boolean;
  error?: string;
  medidas: MedidaPlan[];
}

// Cada medida: "- [ancla: TEXTO] Descripción"
const RE_MEDIDA = /^-\s*\[ancla:\s*(.*?)\]\s*(.+)$/;

/**
 * Parsea el plan a medidas y marca las que no anclan a una acción del catálogo. Recibe
 * las descripciones EXACTAS del catálogo (Tabla 4/7) para verificar el ancla.
 */
export function validarPlan(texto: string, anclasCatalogo: readonly string[]): ResultadoPlan {
  if (texto.length > LARGO_MAXIMO) {
    return { ok: false, error: 'Respuesta demasiado larga.', medidas: [] };
  }
  const catalogo = new Set(anclasCatalogo.map((a) => a.trim()));
  const medidas: MedidaPlan[] = [];
  for (const linea of texto.split('\n')) {
    const m = RE_MEDIDA.exec(linea.trim());
    if (!m) continue;
    const ancla = (m[1] ?? '').trim();
    const descripcion = (m[2] ?? '').trim();
    if (descripcion.length === 0) continue;
    const anclada = ancla !== '' && ancla.toUpperCase() !== 'NINGUNA' && catalogo.has(ancla);
    medidas.push({
      descripcion,
      ancla: anclada ? ancla : '',
      sinAncla: !anclada,
    });
  }
  if (medidas.length === 0) {
    return {
      ok: false,
      error: 'La respuesta no contiene medidas en el formato esperado.',
      medidas: [],
    };
  }
  return { ok: true, medidas };
}
