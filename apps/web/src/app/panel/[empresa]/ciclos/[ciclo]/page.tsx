import { notFound } from 'next/navigation';
import { accionDistribuir, accionRecordatorios } from '@/acciones/panel';
import { BotonAccion } from '@/components/panel/boton-accion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { fechaEsMx } from '@/lib/fechas';
import { GUIAS_POR_CATEGORIA, type NomCategory } from '@/lib/informe';
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
      'id, name, date_start, date_end, evaluator_name, evaluator_license, work_center_id, work_centers (name, nom_category)',
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

  // La confirmación debe decir la consecuencia CONCRETA: cuántos correos saldrán.
  // Distribuir crea (empleado activo × guía) menos lo ya asignado; recordar reenvía
  // a cada asignación pendiente. Espejo del cálculo de accionDistribuir/accionRecordatorios.
  const { count: empleadosActivos } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', empresa)
    .eq('work_center_id', datosCiclo.work_center_id)
    .eq('active', true);
  const guias = GUIAS_POR_CATEGORIA[centro.nom_category as NomCategory] ?? ['GR-I'];
  const totalAsignaciones = asignaciones?.length ?? 0;
  const correosDistribuir = Math.max(0, (empleadosActivos ?? 0) * guias.length - totalAsignaciones);
  const pendientes = [...porArea.values()].reduce((suma, c) => suma + c.pendientes, 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle as="h3">Aplicación de cuestionarios</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-slate-700">
          <p>
            Evaluador: {datosCiclo.evaluator_name} (cédula {datosCiclo.evaluator_license}) · inicia{' '}
            {fechaEsMx(datosCiclo.date_start)}
            {datosCiclo.date_end ? ` · termina ${fechaEsMx(datosCiclo.date_end)}` : ' · en curso'}
          </p>
          <div className="flex flex-wrap gap-3">
            <BotonAccion
              etiqueta="Distribuir cuestionarios"
              accion={distribuir}
              testid="distribuir"
              confirmacion={{
                titulo: '¿Distribuir cuestionarios?',
                descripcion: `Se enviarán ${correosDistribuir} correos, uno por cada cuestionario aún no asignado a un empleado activo del centro, cada uno con su enlace personal. Los correos no se pueden cancelar una vez enviados.`,
                etiquetaConfirmar: `Enviar ${correosDistribuir} correos`,
              }}
            />
            <BotonAccion
              etiqueta="Enviar recordatorios a pendientes"
              accion={recordar}
              variante="outline"
              testid="recordatorios"
              confirmacion={{
                titulo: '¿Enviar recordatorios?',
                descripcion: `Se enviarán ${pendientes} correos a quienes aún no responden. Los enlaces anteriores dejarán de funcionar: cada recordatorio trae un enlace nuevo que sustituye al que el empleado ya tenía.`,
                etiquetaConfirmar: `Enviar ${pendientes} recordatorios`,
              }}
            />
          </div>
          {acceso.membresia.rol === 'consultor' && (
            <p className="text-xs text-texto-terciario">Operando como consultor asignado.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h3">Progreso por área</CardTitle>
        </CardHeader>
        <CardContent>
          {porArea.size === 0 ? (
            <EmptyState
              titulo="Aún no hay cuestionarios distribuidos en este ciclo"
              descripcion="La identificación de factores de riesgo empieza cuando cada empleado recibe su enlace personal (la norma exige evaluar a todos). Usa «Distribuir cuestionarios» arriba: cada quien recibirá un correo con su enlace confidencial."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="progreso-areas">
                <thead>
                  <tr className="border-b border-borde text-left text-xs tracking-wide text-texto-terciario uppercase">
                    <th scope="col" className="py-2 font-medium">
                      Área
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Completados
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Pendientes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...porArea.entries()].map(([area, conteo]) => (
                    <tr key={area} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 font-medium text-texto">{area}</td>
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
