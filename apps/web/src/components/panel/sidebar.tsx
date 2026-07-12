'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BotonSalir } from '@/components/panel/boton-salir';
import { cn } from '@/lib/utils';

const SECCIONES_EMPRESA = [
  ['centros', 'Centros'],
  ['empleados', 'Empleados'],
  ['ciclos', 'Ciclos'],
  ['politica', 'Política'],
  ['capacitacion', 'Capacitación'],
  ['equipo', 'Equipo'],
] as const;

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  // Detecta si estamos dentro de /panel/[empresa]/... (y no en /panel/nueva)
  const coincidencia = pathname.match(/^\/panel\/([^/]+)/);
  const empresa = coincidencia && coincidencia[1] !== 'nueva' ? coincidencia[1] : null;

  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (!abierto) return;
    const alEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', alEscape);
    return () => document.removeEventListener('keydown', alEscape);
  }, [abierto]);

  const marca = (
    <Link
      href="/panel"
      className="text-base font-semibold tracking-tight text-slate-900 hover:text-slate-700"
    >
      Plataforma NOM-035
    </Link>
  );

  const contenido = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-4">{marca}</div>

      {empresa && (
        <nav aria-label="Secciones de la empresa" className="flex flex-col gap-1 px-3 py-4">
          {SECCIONES_EMPRESA.map(([ruta, etiqueta]) => {
            const href = `/panel/${empresa}/${ruta}`;
            const activo = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={ruta}
                href={href}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  activo
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                {etiqueta}
              </Link>
            );
          })}
        </nav>
      )}

      <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 px-4 py-4">
        <span data-testid="usuario-email" className="truncate text-xs text-slate-500">
          {email}
        </span>
        <BotonSalir />
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar fija de escritorio */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
        {contenido}
      </aside>

      {/* Encabezado móvil con botón de menú */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        {marca}
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls="sidebar-movil"
          onClick={() => setAbierto((valor) => !valor)}
          className="rounded-md p-2 text-slate-700 hover:bg-slate-100"
        >
          <span className="sr-only">{abierto ? 'Cerrar menú' : 'Abrir menú'}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-6 w-6"
          >
            {abierto ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Drawer móvil */}
      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="fixed inset-0 bg-slate-900/40"
          />
          <div
            id="sidebar-movil"
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] border-r border-slate-200 bg-white shadow-lg"
          >
            {contenido}
          </div>
        </div>
      )}
    </>
  );
}
