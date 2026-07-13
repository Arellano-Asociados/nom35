import Link from 'next/link';
import * as React from 'react';

export interface Miga {
  etiqueta: string;
  href?: string;
}

/**
 * Migas de pan del panel (auditoría v0, dimensión 4 [Alto]: a 5 niveles de
 * profundidad el único contexto era la razón social). El último elemento es la
 * página actual (`aria-current`), sin enlace.
 */
export function Breadcrumbs({ elementos }: { elementos: Miga[] }) {
  if (elementos.length === 0) return null;
  return (
    <nav aria-label="Ubicación" className="text-sm text-texto-secundario">
      <ol className="flex flex-wrap items-center gap-1">
        {elementos.map((miga, i) => {
          const ultima = i === elementos.length - 1;
          return (
            <li key={`${miga.etiqueta}-${i}`} className="flex items-center gap-1">
              {i > 0 && (
                <span aria-hidden="true" className="text-slate-400">
                  /
                </span>
              )}
              {ultima || !miga.href ? (
                <span aria-current={ultima ? 'page' : undefined} className="font-medium text-texto">
                  {miga.etiqueta}
                </span>
              ) : (
                <Link href={miga.href} className="hover:text-texto hover:underline">
                  {miga.etiqueta}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
