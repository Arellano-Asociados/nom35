import { accionRegistrarCapacitacion, accionSubirCapacitacion } from '@/acciones/panel';
import { ErrorFormulario } from '@/components/panel/error-formulario';
import { RegistroCapacitacion } from '@/components/panel/registro-capacitacion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { claseControl, CampoTexto } from '@/components/ui/input';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PaginaCapacitacion({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorFormulario } = await searchParams;
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
                  <span className="text-sm font-normal text-texto-terciario tabular-nums">
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
          <EmptyState
            titulo="Aún no hay contenidos de capacitación"
            descripcion="La capacitación sobre riesgos psicosociales deja evidencia de qué empleados la recibieron — parte del expediente que revisa un inspector. Sube el primer material con el formulario."
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subir contenido de capacitación</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={subir} className="flex flex-col gap-3 text-sm">
            <ErrorFormulario codigo={errorFormulario} />
            <CampoTexto etiqueta="Título" nombre="titulo" required />
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
              Archivo (PDF)
              <input
                name="archivo"
                type="file"
                required
                accept="application/pdf"
                className={cn(
                  claseControl,
                  'file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700',
                )}
              />
            </label>
            <p className="text-xs text-texto-terciario">Solo PDF, máximo 10 MB.</p>
            <Button type="submit">Subir</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
