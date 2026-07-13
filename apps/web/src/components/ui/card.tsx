import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-borde bg-superficie shadow-superficie', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />;
}

/**
 * Título de card con nivel de encabezado configurable (`as`): un `<h2>` fijo aplanaba
 * la jerarquía de encabezados cuando la card vivía bajo otro h2 (hallazgo Bajo de
 * UX/UI de la auditoría v0).
 */
export function CardTitle({
  className,
  as: Encabezado = 'h2',
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h1' | 'h2' | 'h3' | 'h4' }) {
  return <Encabezado className={cn('text-lg font-semibold text-texto', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}
