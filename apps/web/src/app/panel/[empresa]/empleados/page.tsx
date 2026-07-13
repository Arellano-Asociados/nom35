import { accionCrearEmpleado, accionImportarCsv } from '@/acciones/panel';
import { claseCampo, claseEstadoVacio } from '@/components/panel/campos';
import { ImportadorCsv } from '@/components/panel/importador-csv';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function PaginaEmpleados({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { empresa } = await params;
  const { error } = await searchParams;
  await autorizarEmpresa(empresa);

  const supabase = clienteAdmin();
  const [{ data: empleados }, { data: centros }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, email, area, work_centers (name)')
      .eq('company_id', empresa)
      .order('full_name'),
    supabase.from('work_centers').select('id, name').eq('company_id', empresa).order('name'),
  ]);

  const crear = accionCrearEmpleado.bind(null, empresa);
  const importar = accionImportarCsv.bind(null, empresa);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Empleados ({(empleados ?? []).length})</CardTitle>
        </CardHeader>
        <CardContent>
          {(empleados ?? []).length === 0 && (
            <p className={claseEstadoVacio}>
              Aún no hay empleados. Agrega el primero con el formulario o importa un CSV.
            </p>
          )}
          <ul
            className="flex max-h-96 flex-col gap-1 overflow-y-auto"
            data-testid="lista-empleados"
          >
            {(empleados ?? []).map((e) => (
              <li
                key={e.id}
                className="rounded border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{e.full_name}</span>{' '}
                <span className="text-slate-500">
                  · {e.email} · {e.area ?? 'Sin área'} ·{' '}
                  {(e.work_centers as unknown as { name: string }).name}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Alta individual</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={crear} className="flex flex-col gap-3 text-sm">
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Nombre completo
                <input name="nombre" required className={claseCampo} />
              </label>
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Correo electrónico
                <input name="email" type="email" required className={claseCampo} />
              </label>
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Área
                <input name="area" className={claseCampo} />
              </label>
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Centro de trabajo
                <select name="centro" required className={claseCampo}>
                  {(centros ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-slate-800">
                  <input type="checkbox" name="atiende" value="si" className="accent-marca-700" />{' '}
                  Atiende clientes
                </label>
                <label className="flex items-center gap-2 text-slate-800">
                  <input type="checkbox" name="supervisa" value="si" className="accent-marca-700" />{' '}
                  Supervisa personal
                </label>
              </div>
              {error === 'duplicado' && (
                <p role="alert" className="text-peligro">
                  Ya existe un empleado con ese correo en la empresa.
                </p>
              )}
              <Button type="submit">Agregar empleado</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Importación por CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportadorCsv importar={importar} centros={centros ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
