'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogoConstata } from '@/components/marca/logo';
import { BotonSalir } from '@/components/panel/boton-salir';
import { claseControl } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const SECCIONES_EMPRESA = [
  ['', 'Inicio'],
  ['centros', 'Centros'],
  ['empleados', 'Empleados'],
  ['ciclos', 'Ciclos'],
  ['politica', 'Política'],
  ['capacitacion', 'Capacitación'],
  ['equipo', 'Equipo'],
] as const;

const ETIQUETA_ROL: Record<string, string> = {
  admin_org: 'Admin de Organización',
  consultor: 'Consultor',
  miembro: 'Miembro',
};

export interface MembresiaSidebar {
  companyId: string;
  razonSocial: string;
  rol: string;
}

export function Sidebar({ email, membresias }: { email: string; membresias: MembresiaSidebar[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  // Detecta si estamos dentro de /panel/[empresa]/... (y no en /panel/nueva)
  const coincidencia = pathname.match(/^\/panel\/([^/]+)/);
  const empresa = coincidencia && coincidencia[1] !== 'nueva' ? coincidencia[1] : null;
  const activa = empresa ? membresias.find((m) => m.companyId === empresa) : undefined;

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
    <Link href="/panel" className="inline-flex items-center hover:opacity-85">
      <LogoConstata />
      <span className="sr-only">Ir al inicio del panel</span>
    </Link>
  );

  const contenido = (
    <div className="flex h-full flex-col">
      <div className="border-b border-borde px-4 py-4">{marca}</div>

      {/* Empresa activa: confirmación persistente del tenant sobre el que se actúa
          (auditoría v0, dimensión 4 [Alto]) + selector cuando hay más de una. */}
      {activa && (
        <div className="flex flex-col gap-2 border-b border-borde px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-texto-terciario uppercase">
            Empresa activa
          </p>
          <p className="text-sm font-semibold text-texto" data-testid="empresa-activa">
            {activa.razonSocial}
          </p>
          <p className="text-xs text-texto-secundario">{ETIQUETA_ROL[activa.rol] ?? activa.rol}</p>
          {membresias.length > 1 && (
            <label className="flex flex-col gap-1 text-xs text-texto-secundario">
              <span className="sr-only">Cambiar de empresa</span>
              <select
                value={activa.companyId}
                onChange={(evento) => router.push(`/panel/${evento.target.value}/centros`)}
                className={cn(claseControl, 'h-9 py-1 text-xs')}
              >
                {membresias.map((m) => (
                  <option key={m.companyId} value={m.companyId}>
                    {m.razonSocial}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {empresa && (
        <nav aria-label="Secciones de la empresa" className="flex flex-col gap-1 px-3 py-4">
          {SECCIONES_EMPRESA.map(([ruta, etiqueta]) => {
            const href = ruta ? `/panel/${empresa}/${ruta}` : `/panel/${empresa}`;
            // "Inicio" (ruta vacía) solo con coincidencia exacta: su href es prefijo de todos.
            const activo = ruta
              ? pathname === href || pathname.startsWith(`${href}/`)
              : pathname === href;
            return (
              <Link
                key={ruta}
                href={href}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  activo
                    ? 'bg-marca-50 text-marca-700'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                {etiqueta}
              </Link>
            );
          })}
        </nav>
      )}

      <div className="mt-auto flex flex-col gap-2 border-t border-borde px-4 py-4">
        <span data-testid="usuario-email" className="truncate text-xs text-texto-terciario">
          {email}
        </span>
        <BotonSalir />
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar fija de escritorio */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-borde lg:bg-superficie">
        {contenido}
      </aside>

      {/* Encabezado móvil con botón de menú */}
      <div className="flex items-center justify-between border-b border-borde bg-superficie px-4 py-3 lg:hidden">
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
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] border-r border-borde bg-superficie shadow-lg"
          >
            {contenido}
          </div>
        </div>
      )}
    </>
  );
}
