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
      {/* Suspensión / baja (Fase 5, copy del spec §2.4): el candado real está en BD
          (políticas RESTRICTIVE); este aviso evita el 42501 críptico y dice completo
          qué sigue vigente. */}
      {acceso.membresia.empresaStatus !== 'active' && (
        <div
          role="status"
          data-testid="aviso-suspension"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
        >
          <p className="font-semibold">
            {acceso.membresia.empresaStatus === 'suspended'
              ? 'Tu cuenta está suspendida: el panel funciona en modo solo lectura.'
              : 'Tu cuenta está en proceso de baja: el panel funciona en modo solo lectura.'}
          </p>
          <ul className="mt-2 list-disc pl-5">
            <li>Tus obligaciones NOM-035 siguen vigentes ante la autoridad.</li>
            <li>
              Tu evidencia histórica está disponible en modo lectura y puedes descargarla (informes
              y expedientes ya generados).
            </li>
            <li>
              Los plazos de tus ciclos en curso quedan pausados en la plataforma, no ante la
              autoridad.
            </li>
          </ul>
        </div>
      )}
      {children}
    </div>
  );
}
