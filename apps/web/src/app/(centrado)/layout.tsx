// Envoltura de columna centrada para las rutas fuera del panel (landing, ingreso,
// flujo del empleado). El panel administrativo tiene su propio shell con sidebar
// en apps/web/src/app/panel/layout.tsx y no pasa por este layout.
export default function LayoutCentrado({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">{children}</main>;
}
