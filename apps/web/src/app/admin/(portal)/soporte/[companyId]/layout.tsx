import Link from 'next/link';
import { redirect } from 'next/navigation';
import { accionTerminarAccesoSoporte } from '@/acciones/plataforma';
import { TerminarAcceso } from '@/components/admin/terminar-acceso';
import { autorizarPlataforma, grantSoporteVigente } from '@/lib/autorizacion-plataforma';
import { fichaEmpresaSoporte } from '@/lib/soporte-datos';

// Layout de la vista de soporte. OJO: este layout NO llama autorizarSoporte() — el
// evento "sin evento no hay página" lo deja CADA PÁGINA (una sola vez por vista); aquí
// solo se verifica el grant para el banner y el redirect temprano (UX).

const SECCIONES = [
  ['', 'Ficha'],
  ['centros', 'Centros'],
  ['empleados', 'Empleados'],
  ['ciclos', 'Ciclos'],
  ['flags', 'Flags'],
  ['difusion', 'Difusión'],
  ['programa', 'Programa'],
  ['ia', 'IA'],
  ['bitacora', 'Bitácora'],
] as const;

export default async function LayoutSoporte({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const operador = await autorizarPlataforma();
  const grant = await grantSoporteVigente(companyId, operador.operadorId);
  if (!grant) redirect(`/admin/organizaciones/${companyId}`);

  const ficha = await fichaEmpresaSoporte(companyId);
  const expira = new Intl.DateTimeFormat('es-MX', {
    timeStyle: 'short',
    dateStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date(grant.expires_at));

  const terminar = accionTerminarAccesoSoporte.bind(null, companyId);

  return (
    <div className="flex flex-col gap-4">
      {/* Banner ámbar PERSISTENTE (spec §6.6): el operador nunca olvida dónde está. */}
      <div
        role="status"
        data-testid="banner-soporte"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <p>
          <span className="font-semibold">Vista de soporte SOLO LECTURA</span> —{' '}
          {ficha?.legalName ?? companyId} — expira {expira} — cada página consultada queda
          registrada en la bitácora del cliente.
        </p>
        <TerminarAcceso companyId={companyId} terminar={terminar} />
      </div>

      <nav aria-label="Vista de soporte" className="flex flex-wrap gap-3 text-sm">
        {SECCIONES.map(([ruta, etiqueta]) => (
          <Link
            key={ruta}
            href={`/admin/soporte/${companyId}${ruta ? `/${ruta}` : ''}`}
            className="text-marca-700 underline-offset-4 hover:underline"
          >
            {etiqueta}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
