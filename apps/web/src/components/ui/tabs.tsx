'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface Pestana {
  href: string;
  etiqueta: string;
  /** Activa solo con coincidencia exacta de ruta (para la pestaña raíz/resumen). */
  exacta?: boolean;
}

/**
 * Pestañas de navegación por URL con estado activo (`aria-current`). Nacen para las
 * subsecciones del ciclo (auditoría v0, dimensión 1 [Alto]: las pestañas vivían solo
 * en la página raíz del ciclo y no marcaban la sección activa).
 */
export function Tabs({ pestanas, ariaLabel }: { pestanas: Pestana[]; ariaLabel: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={ariaLabel} className="overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-borde">
        {pestanas.map(({ href, etiqueta, exacta }) => {
          const activa = exacta
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activa ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  activa
                    ? 'border-marca-700 text-marca-700'
                    : 'border-transparent text-texto-secundario hover:border-slate-300 hover:text-texto',
                )}
              >
                {etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
