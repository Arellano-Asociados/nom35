import Link from 'next/link';
import { autorizarEmpresa } from '@/lib/autorizacion';

const PESTANAS = [
  ['centros', 'Centros'],
  ['empleados', 'Empleados'],
  ['ciclos', 'Ciclos'],
  ['politica', 'Política'],
  ['capacitacion', 'Capacitación'],
  ['equipo', 'Equipo'],
] as const;

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
      <div>
        <h1 className="text-xl font-semibold text-slate-900" data-testid="nombre-empresa">
          {acceso.membresia.razonSocial}
        </h1>
        <nav aria-label="Secciones de la empresa" className="mt-2 flex flex-wrap gap-1">
          {PESTANAS.map(([ruta, etiqueta]) => (
            <Link
              key={ruta}
              href={`/panel/${empresa}/${ruta}`}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              {etiqueta}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
