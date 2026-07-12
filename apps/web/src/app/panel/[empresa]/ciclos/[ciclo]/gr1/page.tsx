import { accionActualizarCanalizacion } from '@/acciones/panel';
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
        <CardContent className="p-6 text-sm text-slate-700" data-testid="gr1-restringido">
          Esta vista es exclusiva del <strong>Responsable Designado</strong>. Las canalizaciones
          GR-I contienen datos personales sensibles.
        </CardContent>
      </Card>
    );
  }

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
        <CardTitle>Canalizaciones GR-I (valoración clínica requerida)</CardTitle>
      </CardHeader>
      <CardContent>
        {(canalizaciones ?? []).length === 0 ? (
          <p className="text-sm text-slate-600">No hay canalizaciones pendientes en este ciclo.</p>
        ) : (
          <table className="w-full text-sm" data-testid="tabla-gr1">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2">Trabajador</th>
                <th className="py-2">Área</th>
                <th className="py-2">Fecha de resultado</th>
                <th className="py-2">Canalización</th>
                <th className="py-2">Fecha de canalización</th>
              </tr>
            </thead>
            <tbody>
              {(canalizaciones ?? []).map((c) => {
                const empleado = c.employees as unknown as {
                  full_name: string;
                  area: string | null;
                };
                return (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{empleado.full_name}</td>
                    <td className="py-2">{empleado.area ?? 'Sin área'}</td>
                    <td className="py-2">{String(c.created_at).slice(0, 10)}</td>
                    <td className="py-2">
                      <SelectorCanalizacion
                        gr1Id={c.id}
                        estatusActual={c.canalizacion_estatus}
                        actualizar={actualizar}
                      />
                    </td>
                    <td className="py-2">{c.canalizacion_fecha ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
