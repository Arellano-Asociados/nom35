import { autorizarEmpresa } from '@/lib/autorizacion';

// La navegación entre secciones de la empresa (Centros/Empleados/Ciclos/Política/
// Capacitación/Equipo) vive en el sidebar (src/components/panel/sidebar.tsx), que
// detecta la empresa activa a partir de la URL. Este layout solo aporta el
// encabezado con el nombre de la empresa para las páginas anidadas.
export default async function LayoutEmpresa({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ empresa: string }>;
}) {
  const { empresa } = await params;
  const acceso = await autorizarEmpresa(empresa);

  return (
    <div className="flex flex-col gap-4">
      <h1
        className="text-2xl font-semibold tracking-tight text-slate-900"
        data-testid="nombre-empresa"
      >
        {acceso.membresia.razonSocial}
      </h1>
      {children}
    </div>
  );
}
