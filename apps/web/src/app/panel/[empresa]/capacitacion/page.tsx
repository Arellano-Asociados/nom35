import { accionRegistrarCapacitacion, accionSubirCapacitacion } from '@/acciones/panel';
import { RegistroCapacitacion } from '@/components/panel/registro-capacitacion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function PaginaCapacitacion({
  params,
}: {
  params: Promise<{ empresa: string }>;
}) {
  const { empresa } = await params;
  await autorizarEmpresa(empresa);

  const supabase = clienteAdmin();
  const [{ data: contenidos }, { data: empleados }, { data: registros }] = await Promise.all([
    supabase
      .from('training_contents')
      .select('id, title, created_at')
      .eq('company_id', empresa)
      .order('created_at', { ascending: false }),
    supabase
      .from('employees')
      .select('id, full_name')
      .eq('company_id', empresa)
      .eq('active', true)
      .order('full_name'),
    supabase.from('training_records').select('training_id, employee_id').eq('company_id', empresa),
  ]);

  const completados = new Set((registros ?? []).map((r) => `${r.training_id}:${r.employee_id}`));
  const subir = accionSubirCapacitacion.bind(null, empresa);
  const registrar = accionRegistrarCapacitacion.bind(null, empresa);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        {(contenidos ?? []).map((contenido) => {
          const lista = (empleados ?? []).map((e) => ({
            id: e.id,
            nombre: e.full_name,
            completado: completados.has(`${contenido.id}:${e.id}`),
          }));
          const total = lista.length;
          const hechos = lista.filter((e) => e.completado).length;
          return (
            <Card key={contenido.id}>
              <CardHeader>
                <CardTitle>
                  {contenido.title}{' '}
                  <span className="text-sm font-normal text-slate-500">
                    ({hechos}/{total} completados)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RegistroCapacitacion
                  trainingId={contenido.id}
                  empleados={lista}
                  registrar={registrar}
                />
              </CardContent>
            </Card>
          );
        })}
        {(contenidos ?? []).length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-slate-600">
              Aún no hay contenidos de capacitación.
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subir contenido de capacitación</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={subir} className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Título
              <input
                name="titulo"
                required
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Archivo
              <input
                name="archivo"
                type="file"
                required
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <Button type="submit">Subir</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
