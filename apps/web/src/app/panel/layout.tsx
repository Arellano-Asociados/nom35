import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Toaster } from 'sonner';
import { Sidebar } from '@/components/panel/sidebar';
import { membresiasDe } from '@/lib/autorizacion';
import { usuarioActual } from '@/lib/supabase-servidor';
import paquete from '../../../package.json';

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/ingresar');
  // Las membresías alimentan la "empresa activa" y el selector del sidebar (auditoría
  // v0, dimensión 4 [Alto]: una consultora multi-empresa no tenía confirmación
  // persistente de en qué tenant estaba actuando).
  const membresias = await membresiasDe(usuario.id);

  return (
    <div className="min-h-screen">
      {/* Enlace "saltar al contenido" (WCAG 2.4.1): sin él, llegar al contenido del
          panel exigía 8+ tabulaciones por página (hallazgo Medio de la auditoría v0). */}
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-marca-700 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>
      <Sidebar
        email={usuario.email ?? ''}
        membresias={membresias.map((m) => ({
          companyId: m.companyId,
          razonSocial: m.razonSocial,
          rol: m.rol,
        }))}
      />
      <main id="contenido" className="lg:pl-64">
        <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex-1">{children}</div>
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-4 text-xs text-texto-secundario">
            <span>Constata v{paquete.version} — evidencia de cumplimiento NOM-035-STPS-2018</span>
            <Link href="/privacidad" className="underline hover:text-texto">
              Aviso de privacidad y derechos ARCO
            </Link>
          </footer>
        </div>
      </main>
      {/* Toasts del panel: capa complementaria a los mensajes inline (role="alert"/*-detalle),
          que se conservan intactos porque el E2E los asierta. top-right + offset para no tapar
          el encabezado móvil (con el botón de menú) ni los controles que Playwright hace clic
          en viewports angostos (390px). sonner usa mobileOffset (no offset) por debajo de los
          600px de ancho, así que se fijan ambos con el mismo valor. */}
      <Toaster
        richColors
        position="top-right"
        offset={{ top: '4.5rem' }}
        mobileOffset={{ top: '4.5rem' }}
      />
    </div>
  );
}
