/**
 * Marca Constata (docs/BRAND.md). El isotipo es una palomita que remata sobre una
 * línea base: verificar Y dejar constancia — el diferenciador del producto (evidencia
 * inmutable exhibible ante la STPS). Los hex del isotipo son los tokens de marca
 * (`--color-marca-700` y blanco); viven aquí como literales porque el SVG es un
 * artefacto de marca autocontenido (mismo dibujo que `app/icon.svg`).
 */

import { cn } from '@/lib/utils';

export function IsotipoConstata({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn('h-7 w-7 shrink-0', className)}
      fill="none"
    >
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#2b4193" />
      <path
        d="M9.5 16.5l4.5 4.5 8.5-10"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 25.5h12"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity=".55"
      />
    </svg>
  );
}

/**
 * Logotipo completo: isotipo + wordmark. `claro` invierte el wordmark para fondos de
 * marca oscuros (panel izquierdo del login).
 */
export function LogoConstata({
  className,
  claro = false,
  tamano = 'base',
}: {
  className?: string;
  claro?: boolean;
  tamano?: 'base' | 'grande';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <IsotipoConstata className={tamano === 'grande' ? 'h-9 w-9' : 'h-7 w-7'} />
      <span
        className={cn(
          'font-semibold tracking-tight',
          tamano === 'grande' ? 'text-2xl' : 'text-lg',
          claro ? 'text-white' : 'text-slate-900',
        )}
      >
        Constata
      </span>
    </span>
  );
}
