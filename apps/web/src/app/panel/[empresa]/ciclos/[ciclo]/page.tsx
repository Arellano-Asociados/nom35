import Link from 'next/link';
import { notFound } from 'next/navigation';
import { accionDistribuir, accionRecordatorios } from '@/acciones/panel';
import { BotonAccion } from '@/components/panel/boton-accion';
import { claseEstadoVacio } from '@/components/panel/campos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function PaginaCiclo({
  params,
}: {
  params: Promise<{ empresa: string; ciclo: string }>;
}) {
  const { empresa, ciclo } = await params;
  const acceso = await autorizarEmpresa(empresa);

  const supabase = clienteAdmin();
  const { data: datosCiclo } = await supabase
    .from('compliance_cycles')
    .select(
      'id, name, date_start, date_end, evaluator_name, evaluator_license, work_centers (name, nom_category)',
    )
    .eq('company_id', empresa)
    .eq('id', ciclo)
    .maybeSingle();
  if (!datosCiclo) notFound();

  const { data: asignaciones } = await supabase
    .from('questionnaire_assignments')
    .select('id, completed_at, employees (area), questionnaires (code)')
    .eq('company_id', empresa)
    .eq('cycle_id', ciclo);

  // Progreso por área: conteos de completados/pendientes (nunca resultados)
  const porArea = new Map<string, { completados: number; pendientes: number }>();
  for (const a of asignaciones ?? []) {
    const area = (a.employees as unknown as { area: string | null }).area ?? 'Sin área';
    const acumulado = porArea.get(area) ?? { completados: 0, pendientes: 0 };
    if (a.completed_at) acumulado.completados++;
    else acumulado.pendientes++;
    porArea.set(area, acumulado);
  }

  const distribuir = accionDistribuir.bind(null, empresa, ciclo);
  const recordar = accionRecordatorios.bind(null, empresa, ciclo);
  const centro = datosCiclo.work_centers as unknown as { name: string; nom_category: string };

  const SUBPAGINAS = [
    ['dashboard', 'Dashboard agregado'],
    ['acciones', 'Acciones (Cap. 8)'],
    ['gr1', 'Canalizaciones GR-I'],
    ['individual', 'Resultados individuales'],
    ['informes', 'Informes y expediente'],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {datosCiclo.name} · {centro.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-slate-700">
          <p>
            Evaluador: {datosCiclo.evaluator_name} (cédula {datosCiclo.evaluator_license}) ·{' '}
            {datosCiclo.date_start} — {datosCiclo.date_end ?? 'en curso'}
          </p>
          <nav
            aria-label="Secciones del ciclo"
            className="flex flex-wrap gap-1 border-b border-slate-200 pb-px"
          >
            {SUBPAGINAS.map(([ruta, etiqueta]) => (
              <Link
                key={ruta}
                href={`/panel/${empresa}/ciclos/${ciclo}/${ruta}`}
                className="rounded-t-md px-3 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                {etiqueta}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap gap-3">
            <BotonAccion
              etiqueta="Distribuir cuestionarios"
              accion={distribuir}
              testid="distribuir"
            />
            <BotonAccion
              etiqueta="Enviar recordatorios a pendientes"
              accion={recordar}
              variante="outline"
              testid="recordatorios"
            />
          </div>
          {acceso.membresia.rol === 'consultor' && (
            <p className="text-xs text-slate-500">Operando como consultor asignado.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Progreso por área</CardTitle>
        </CardHeader>
        <CardContent>
          {porArea.size === 0 ? (
            <p className={claseEstadoVacio}>
              Aún no hay cuestionarios distribuidos en este ciclo. Usa &quot;Distribuir
              cuestionarios&quot; arriba.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="progreso-areas">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                    <th className="py-2 font-medium">Área</th>
                    <th className="py-2 text-right font-medium">Completados</th>
                    <th className="py-2 text-right font-medium">Pendientes</th>
                  </tr>
                </thead>
                <tbody>
                  {[...porArea.entries()].map(([area, conteo]) => (
                    <tr key={area} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-900">{area}</td>
                      <td className="py-2 text-right text-slate-700 tabular-nums">
                        {conteo.completados}
                      </td>
                      <td className="py-2 text-right text-slate-700 tabular-nums">
                        {conteo.pendientes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
