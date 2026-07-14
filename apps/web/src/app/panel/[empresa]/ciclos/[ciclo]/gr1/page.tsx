import Link from 'next/link';
import { accionActualizarCanalizacion } from '@/acciones/panel';
import { claseEstadoVacio } from '@/components/panel/campos';
import { SelectorCanalizacion } from '@/components/panel/selector-canalizacion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function PaginaGR1({
  params,
}: {
  params: Promise<{ empresa: string; ciclo: string }>;
}) {
  const { empresa, ciclo } = await params;
  const acceso = await autorizarEmpresa(empresa);

  if (!acceso.membresia.esResponsableDesignado) {
    return (
      <Card>
        <CardContent
          className="flex flex-col gap-2 p-6 text-sm text-slate-700"
          data-testid="gr1-restringido"
        >
          <p>
            Esta vista es exclusiva del <strong>Responsable Designado</strong>: contiene datos
            personales sensibles de salud.
          </p>
          {acceso.membresia.rol === 'admin_org' && (
            <p>
              <Link
                href={`/panel/${empresa}/equipo`}
                className="font-medium text-marca-700 underline hover:text-marca-800"
              >
                Designa al Responsable en Equipo
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // service_role legítimo (Fase 2.5): gr1_results no tiene GRANT para authenticated
  // (regla 5). Guardia de RD arriba; el acceso queda en la superficie exclusiva del RD.
  const { data: canalizaciones } = await clienteAdmin()
    .from('gr1_results')
    .select(
      'id, requiere_valoracion, canalizacion_estatus, canalizacion_fecha, created_at, employees (full_name, area)',
    )
    .eq('company_id', empresa)
    .eq('cycle_id', ciclo)
    .eq('requiere_valoracion', true)
    .order('created_at');

  const actualizar = accionActualizarCanalizacion.bind(null, empresa);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trabajadores que requieren valoración clínica</CardTitle>
        <p className="text-xs text-texto-secundario">
          Guía de Referencia I: acontecimientos traumáticos severos
        </p>
      </CardHeader>
      <CardContent>
        {(canalizaciones ?? []).length === 0 ? (
          <p className={claseEstadoVacio}>No hay canalizaciones pendientes en este ciclo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="tabla-gr1">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                  <th className="py-2 font-medium">Trabajador</th>
                  <th className="py-2 font-medium">Área</th>
                  <th className="py-2 font-medium">Fecha de resultado</th>
                  <th className="py-2 font-medium">Canalización</th>
                  <th className="py-2 font-medium">Fecha de canalización</th>
                </tr>
              </thead>
              <tbody>
                {(canalizaciones ?? []).map((c) => {
                  const empleado = c.employees as unknown as {
                    full_name: string;
                    area: string | null;
                  };
                  return (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-900">{empleado.full_name}</td>
                      <td className="py-2 text-slate-700">{empleado.area ?? 'Sin área'}</td>
                      <td className="py-2 text-slate-700 tabular-nums">
                        {String(c.created_at).slice(0, 10)}
                      </td>
                      <td className="py-2">
                        <SelectorCanalizacion
                          gr1Id={c.id}
                          estatusActual={c.canalizacion_estatus}
                          actualizar={actualizar}
                        />
                      </td>
                      <td className="py-2 text-slate-700 tabular-nums">
                        {c.canalizacion_fecha ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
