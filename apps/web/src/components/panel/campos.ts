/**
 * Clase compartida para inputs/selects/textareas de los formularios del panel: mismo
 * tamaño, borde y transición en toda la app. El anillo de foco visible lo aporta la regla
 * global `:focus-visible` de `globals.css`, así que no hace falta repetirlo aquí.
 */
export const claseCampo =
  'w-full rounded-md border border-slate-400 px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 hover:border-slate-400';

/** Contenedor de estado vacío: una línea amable + guía sutil, sin nuevos elementos interactivos. */
export const claseEstadoVacio =
  'rounded-md border border-dashed border-slate-400 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500';
