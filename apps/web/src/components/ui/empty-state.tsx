import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Estado vacío con explicación y CTA (auditoría v0, dimensión 4: "cero onboarding" y
 * "selects vacíos sin salida"). Contrato de contenido: `titulo` dice QUÉ falta,
 * `descripcion` dice POR QUÉ importa para la norma, `cta` lleva a resolverlo.
 */
export function EmptyState({
  titulo,
  descripcion,
  cta,
  className,
  testid,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  cta?: React.ReactNode;
  className?: string;
  testid?: string;
}) {
  return (
    <div
      data-testid={testid}
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed border-borde-control bg-slate-50/60 px-6 py-10 text-center',
        className,
      )}
    >
      <p className="text-sm font-semibold text-texto">{titulo}</p>
      {descripcion && (
        <p className="max-w-md text-sm leading-relaxed text-texto-secundario">{descripcion}</p>
      )}
      {cta}
    </div>
  );
}
