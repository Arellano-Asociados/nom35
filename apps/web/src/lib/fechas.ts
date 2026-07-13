/**
 * Fechas en es-MX para la UI (auditoría v0, dimensión 1 [Medio]: fechas ISO crudas
 * como "inicia 2026-07-12"). Las fechas de negocio son columnas `date` (sin hora):
 * se interpretan como fecha civil, ancladas a mediodía UTC para que ningún huso las
 * corra de día.
 */
export function fechaEsMx(iso: string | null | undefined): string {
  if (!iso) return '—';
  const soloFecha = iso.slice(0, 10);
  const fecha = new Date(`${soloFecha}T12:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(fecha);
}
