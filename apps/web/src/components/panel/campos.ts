/**
 * Alias históricos del panel. La clase canónica de controles vive en
 * `components/ui/input.tsx` (`claseControl`); se re-exporta aquí para no tocar a
 * todos los consumidores de golpe. Formularios nuevos: usar CampoTexto/CampoSelect.
 */
export { claseControl as claseCampo } from '@/components/ui/input';

/** Contenedor de estado vacío legado; los rediseños usan `<EmptyState>` (ui/empty-state). */
export const claseEstadoVacio =
  'rounded-md border border-dashed border-slate-400 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500';
