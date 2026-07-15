// Lógica PURA del acta de purga (decisión sellada 7, spec §2.6). Módulo sin I/O para
// poder probarla con TDD desde la suite web; scripts/purgar-empresa.mjs la consume.

export const HITOS_RETENCION = [1, 30, 60, 85];

/**
 * ¿Están los 4 avisos de retención? La purga solo es defendible si se puede probar que
 * se avisó: falta uno → no hay purga.
 * @param {{ hito: number }[]} avisos filas de aviso_retencion_enviado (details.hito)
 */
export function avisosCompletos(avisos) {
  const hitos = new Set(avisos.map((a) => Number(a.hito)));
  return HITOS_RETENCION.every((h) => hitos.has(h));
}

/**
 * ¿Venció el plazo de retención?
 * @param {string} deletionRequestedAt ISO
 * @param {number} ahoraMs
 * @param {number} retencionDias
 */
export function plazoCumplido(deletionRequestedAt, ahoraMs, retencionDias) {
  const limite = new Date(deletionRequestedAt).getTime() + retencionDias * 24 * 60 * 60 * 1000;
  return ahoraMs > limite;
}

/**
 * Arma los `details` del evento `empresa_purgada`: el acta CON INVENTARIO que sobrevive
 * a la purga. Conteos por entidad y huellas sha256 de lo que existió — huellas, JAMÁS
 * contenido.
 * @param {{
 *   empresa: { legal_name: string, rfc: string | null, deletion_requested_at: string },
 *   avisos: { hito: number, enviado_el: string }[],
 *   inventario: Record<string, number>,
 *   huellas: {
 *     expedientes: { ciclo: string, sha256: string }[],
 *     informes: { ciclo: string, sha256: string }[],
 *     constancias: { ciclo: string, version: number, sha256: string }[],
 *   },
 * }} entrada
 */
export function armarActaPurga({ empresa, avisos, inventario, huellas }) {
  const ENTIDADES = [
    'centros',
    'empleados',
    'ciclos',
    'asignaciones',
    'respuestas',
    'resultados',
    'informes',
    'quejas',
    'eventos_ats',
    'constancias_difusion',
    'programas',
    'borradores_ia', // Fase 6: ai_drafts es dato del tenant y se purga con él
  ];
  const faltantes = ENTIDADES.filter((e) => !(e in inventario));
  if (faltantes.length > 0) {
    throw new Error(`Inventario incompleto: faltan conteos de ${faltantes.join(', ')}`);
  }
  if (!avisosCompletos(avisos)) {
    throw new Error('Acta inadmisible: faltan avisos de retención (la purga exige los 4)');
  }
  return {
    legal_name: empresa.legal_name,
    rfc: empresa.rfc,
    deletion_requested_at: empresa.deletion_requested_at,
    avisos: [...avisos].sort((a, b) => a.hito - b.hito),
    inventario: Object.fromEntries(ENTIDADES.map((e) => [e, inventario[e]])),
    huellas: {
      expedientes: huellas.expedientes,
      informes: huellas.informes,
      constancias: huellas.constancias,
    },
  };
}
