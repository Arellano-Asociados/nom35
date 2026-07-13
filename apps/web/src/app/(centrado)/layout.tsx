// Envoltura de columna centrada para las rutas fuera del panel (landing, ingreso,
// flujo del empleado). El panel administrativo tiene su propio shell con sidebar
// en apps/web/src/app/panel/layout.tsx y no pasa por este layout.

// Render dinámico obligatorio para la CSP con nonce (auditoría v0): una página
// prerenderizada de forma estática sirve siempre el mismo HTML, así que sus <script>
// no pueden llevar el nonce de ESTA petición y la CSP los bloquearía. La landing y el
// ingreso son triviales, así que el costo de renderizarlas por petición es nulo.
// (El flujo del empleado ya era force-dynamic por su propia naturaleza.)
export const dynamic = 'force-dynamic';

export default function LayoutCentrado({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">{children}</main>;
}
