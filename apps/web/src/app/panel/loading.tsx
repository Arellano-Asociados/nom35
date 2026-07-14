import { Skeleton } from '@/components/ui/skeleton';

/**
 * Estado de carga del panel (cerraba la tríada error/not-found/loading de la
 * auditoría v0, C-05): una navegación lenta ya no se ve como "no pasó nada" —
 * la silueta de una card aparece de inmediato.
 */
export default function CargandoPanel() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      <Skeleton className="h-8 w-64" />
      <div className="rounded-xl border border-borde bg-superficie p-6 shadow-superficie">
        <Skeleton className="mb-4 h-6 w-48" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
