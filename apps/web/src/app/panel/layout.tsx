import { redirect } from 'next/navigation';
import { Toaster } from 'sonner';
import { Sidebar } from '@/components/panel/sidebar';
import { usuarioActual } from '@/lib/supabase-servidor';

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/ingresar');

  return (
    <div className="min-h-screen">
      <Sidebar email={usuario.email ?? ''} />
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
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
