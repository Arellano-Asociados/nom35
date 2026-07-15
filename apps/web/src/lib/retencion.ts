// Lógica pura del job de retención (spec §2.5, decisión sellada 6). El espejo de estos
// hitos para el script de purga vive en scripts/acta-purga.mjs (avisosCompletos).

export const HITOS_RETENCION = [1, 30, 60, 85] as const;

/**
 * Hito de aviso que corresponde HOY (o null): el MAYOR hito alcanzado por los días
 * transcurridos desde la solicitud de baja que aún no se haya enviado. Si el cron
 * estuvo caído varios días, envía solo el más reciente (no inunda al cliente).
 */
export function hitoPendiente(
  deletionRequestedAt: string,
  ahoraMs: number,
  hitosEnviados: number[],
): number | null {
  const dias = Math.floor(
    (ahoraMs - new Date(deletionRequestedAt).getTime()) / (24 * 60 * 60 * 1000),
  );
  const enviados = new Set(hitosEnviados.map(Number));
  const alcanzados = HITOS_RETENCION.filter((h) => dias >= h && !enviados.has(h));
  return alcanzados.length > 0 ? Math.max(...alcanzados) : null;
}

/** Fecha límite de descarga (fin de la retención) para el copy del aviso. */
export function fechaLimiteRetencion(deletionRequestedAt: string, retencionDias: number): Date {
  return new Date(new Date(deletionRequestedAt).getTime() + retencionDias * 24 * 60 * 60 * 1000);
}
