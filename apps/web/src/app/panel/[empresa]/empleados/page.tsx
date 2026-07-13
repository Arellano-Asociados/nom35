import Link from 'next/link';
import { accionCrearEmpleado, accionImportarCsv } from '@/acciones/panel';
import { ImportadorCsv } from '@/components/panel/importador-csv';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { CampoSelect, CampoTexto } from '@/components/ui/input';
import { TablaDatos } from '@/components/ui/tabla-datos';
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
  const sinCentros = (centros ?? []).length === 0;

  const filas = (empleados ?? []).map((e) => ({
    nombre: e.full_name,
    correo: e.email,
    area: e.area ?? 'Sin área',
    centro: (e.work_centers as unknown as { name: string }).name,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Empleados ({filas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Búsqueda + orden + paginación: con 101–500 empleados (el segmento objetivo)
              una caja con scroll era inmanejable (auditoría v0, dimensión 1 [Medio]). */}
          <TablaDatos
            testid="lista-empleados"
            etiquetaBusqueda="Buscar por nombre, correo, área o centro"
            columnas={[
              { clave: 'nombre', titulo: 'Nombre', ordenable: true },
              { clave: 'correo', titulo: 'Correo' },
              { clave: 'area', titulo: 'Área', ordenable: true },
              { clave: 'centro', titulo: 'Centro', ordenable: true },
            ]}
            filas={filas}
            vacio={
              <EmptyState
                titulo="Aún no hay empleados"
                descripcion="La evaluación es censal: todos los trabajadores del centro reciben su cuestionario, así que este padrón es la base de todo el ciclo. Agrégalos con el formulario o cópialos desde Excel."
              />
            }
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Alta individual</CardTitle>
          </CardHeader>
          <CardContent>
            {sinCentros ? (
              <EmptyState
                titulo="Primero crea un centro de trabajo"
                descripcion="Cada empleado pertenece a un centro, y sin centro no hay a dónde asignarlo."
                cta={
                  <Link
                    href={`/panel/${empresa}/centros`}
                    className="text-sm font-medium text-marca-700 underline hover:text-marca-800"
                  >
                    Ir a Centros
                  </Link>
                }
              />
            ) : (
              <form action={crear} className="flex flex-col gap-3 text-sm">
                <CampoTexto etiqueta="Nombre completo" nombre="nombre" required />
                <CampoTexto etiqueta="Correo electrónico" nombre="email" type="email" required />
                <CampoTexto etiqueta="Área" nombre="area" />
                <CampoSelect etiqueta="Centro de trabajo" nombre="centro" required>
                  {(centros ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </CampoSelect>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-slate-800">
                    <input type="checkbox" name="atiende" value="si" className="accent-marca-700" />{' '}
                    Atiende clientes
                  </label>
                  <label className="flex items-center gap-2 text-slate-800">
                    <input
                      type="checkbox"
                      name="supervisa"
                      value="si"
                      className="accent-marca-700"
                    />{' '}
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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Importar lista de empleados (desde Excel)</CardTitle>
          </CardHeader>
          <CardContent>
            {sinCentros ? (
              <EmptyState
                titulo="Primero crea un centro de trabajo"
                descripcion="La importación asigna a cada persona a un centro."
                cta={
                  <Link
                    href={`/panel/${empresa}/centros`}
                    className="text-sm font-medium text-marca-700 underline hover:text-marca-800"
                  >
                    Ir a Centros
                  </Link>
                }
              />
            ) : (
              <ImportadorCsv importar={importar} centros={centros ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
