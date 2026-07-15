import Link from 'next/link';
import { Toaster } from 'sonner';
import { LogoConstata } from '@/components/marca/logo';
import { BotonSalir } from '@/components/panel/boton-salir';
import { autorizarPlataforma } from '@/lib/autorizacion-plataforma';
import paquete from '../../../../package.json';

// Portal super-admin de plataforma. El layout llama autorizarPlataforma() solo para UX
// (redirect temprano): CADA página y CADA acción la llaman de nuevo como primera línea —
// el layout no protege server actions.

const NAV = [
  { href: '/admin', etiqueta: 'Inicio' },
  { href: '/admin/organizaciones', etiqueta: 'Organizaciones' },
  { href: '/admin/operadores', etiqueta: 'Operadores' },
  { href: '/admin/bitacora', etiqueta: 'Bitácora' },
] as const;

export default async function LayoutPortalAdmin({ children }: { children: React.ReactNode }) {
  const operador = await autorizarPlataforma();

  return (
    <div className="min-h-screen">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-marca-700 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>
      {/* Encabezado oscuro: distinción visual permanente entre operar la PLATAFORMA y
          administrar una empresa (el panel es claro). */}
      <header className="bg-marca-900 text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <LogoConstata claro />
            <span className="rounded bg-marca-700 px-2 py-0.5 text-xs font-semibold tracking-wide uppercase">
              Operación de plataforma
            </span>
          </div>
          <nav aria-label="Portal de plataforma" className="flex flex-wrap items-center gap-4">
            {NAV.map(({ href, etiqueta }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-marca-100 underline-offset-4 hover:text-white hover:underline"
              >
                {etiqueta}
              </Link>
            ))}
            <span className="text-xs text-marca-300">{operador.email}</span>
            <span className="text-marca-100 [&>button]:text-marca-100 [&>button]:hover:text-white">
              <BotonSalir />
            </span>
          </nav>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        {children}
        <footer className="mt-10 border-t border-borde pt-4 text-xs text-texto-secundario">
          Constata v{paquete.version} — portal de operación. Cada acto queda en la bitácora de
          plataforma.
        </footer>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
