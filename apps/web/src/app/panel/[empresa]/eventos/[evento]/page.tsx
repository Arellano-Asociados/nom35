import Link from 'next/link';
import { notFound } from 'next/navigation';
import { accionDistribuirEvento } from '@/acciones/eventos';
import { DistribuirEvento } from '@/components/panel/distribuir-evento';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { fechaEsMx } from '@/lib/fechas';
import { clienteSesion } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';

export default async function PaginaEvento({
  params,
}: {
  params: Promise<{ empresa: string; evento: string }>;
}) {
  const { empresa, evento: eventoId } = await params;
  const acceso = await autorizarEmpresa(empresa);
  const gestiona = puedeGestionar(acceso.membresia);
  const esRd = acceso.membresia.esResponsableDesignado;
  if (!gestiona && !esRd) notFound();

  const supabase = await clienteSesion();
  const { data: evento } = await supabase
    .from('traumatic_events')
    .select('id, occurred_on, description, work_center_id, work_centers (name)')
    .eq('company_id', empresa)
    .eq('id', eventoId)
    .maybeSingle();
  if (!evento) notFound();

  // El ciclo ATS es interno (no aparece en Ciclos): agrupa esta aplicación reactiva de GR-I.
  const { data: ciclo } = await supabase
    .from('compliance_cycles')
    .select('id')
    .eq('company_id', empresa)
    .eq('traumatic_event_id', eventoId)
    .maybeSingle();

  const [{ data: empleados }, { data: asignaciones }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name')
      .eq('company_id', empresa)
      .eq('work_center_id', evento.work_center_id)
      .eq('active', true)
      .order('full_name'),
    ciclo
      ? supabase
          .from('questionnaire_assignments')
          .select('employee_id, completed_at')
          .eq('company_id', empresa)
          .eq('cycle_id', ciclo.id)
      : Promise.resolve({ data: [] as { employee_id: string; completed_at: string | null }[] }),
  ]);

  const asignados = asignaciones ?? [];
  const yaAsignados = new Set(asignados.map((a) => a.employee_id));
  const completados = asignados.filter((a) => a.completed_at !== null).length;
  const centro = (evento.work_centers as unknown as { name: string }).name;

  // Los conteos de canalización (quién requiere valoración) NO se muestran aquí: son
  // resultado individual y solo el Responsable Designado los ve, en su propia página
  // auditada (regla inviolable 5).
  const distribuir = accionDistribuirEvento.bind(null, empresa, eventoId);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Acontecimiento del {fechaEsMx(evento.occurred_on)}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-texto">{evento.description}</p>
          <p className="text-texto-secundario">Centro de trabajo: {centro}</p>
          <dl className="mt-2 grid grid-cols-2 gap-3 sm:max-w-sm">
            <div className="rounded-md border border-borde px-3 py-2">
              <dt className="text-xs text-texto-terciario">Cuestionarios asignados</dt>
              <dd className="text-lg font-semibold text-texto" data-testid="evento-asignados">
                {asignados.length}
              </dd>
            </div>
            <div className="rounded-md border border-borde px-3 py-2">
              <dt className="text-xs text-texto-terciario">Completados</dt>
              <dd className="text-lg font-semibold text-texto" data-testid="evento-completados">
                {completados}
              </dd>
            </div>
          </dl>
          {ciclo && esRd && (
            <Link
              href={`/panel/${empresa}/ciclos/${ciclo.id}/gr1`}
              className="mt-2 text-sm font-medium text-marca-700 underline hover:text-marca-800"
              data-testid="canalizaciones-evento"
            >
              Ver canalizaciones de este acontecimiento
            </Link>
          )}
        </CardContent>
      </Card>

      {gestiona && (
        <Card>
          <CardHeader>
            <CardTitle>Aplicar la Guía de Referencia I</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-texto-secundario">
              La Guía I se aplica a los trabajadores que presenciaron o sufrieron el acontecimiento
              (numeral 6.5), no a todo el centro. Quien resulte con necesidad de valoración clínica
              aparecerá en las canalizaciones que atiende el Responsable Designado.
            </p>
            <DistribuirEvento
              empleados={(empleados ?? []).map((e) => ({
                id: e.id,
                nombre: e.full_name,
                yaAsignado: yaAsignados.has(e.id),
              }))}
              distribuir={distribuir}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
