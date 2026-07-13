import { cn } from '@/lib/utils';

/** Bloque de carga (pulso). Composición: el caller dibuja la silueta de su contenido. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-slate-200', className)} />
  );
}
