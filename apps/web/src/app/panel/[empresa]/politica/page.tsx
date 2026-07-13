import { accionSubirPolitica } from '@/acciones/panel';
import { ErrorFormulario } from '@/components/panel/error-formulario';
import { claseCampo, claseEstadoVacio } from '@/components/panel/campos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PaginaPolitica({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { empresa } = await params;
  const { error: errorFormulario } = await searchParams;
  await autorizarEmpresa(empresa);

  const supabase = clienteAdmin();
  const [{ data: politicas }, { count: totalEmpleados }] = await Promise.all([
    supabase
      .from('policies')
      .select('id, title, version, published_at, policy_acknowledgments (id)')
      .eq('company_id', empresa)
      .order('published_at', { ascending: false }),
    supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', empresa)
      .eq('active', true),
  ]);

  const subir = accionSubirPolitica.bind(null, empresa);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Política de prevención de riesgos psicosociales</CardTitle>
        </CardHeader>
        <CardContent>
          {(politicas ?? []).length === 0 ? (
            <p className={claseEstadoVacio}>
              Aún no se publica una política. Publica la primera con el formulario.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm" data-testid="lista-politicas">
              {(politicas ?? []).map((p) => (
                <li key={p.id} className="rounded-md border border-slate-200 px-4 py-3">
                  <p className="font-medium text-slate-900">
                    {p.title} (versión {p.version})
                  </p>
                  <p className="text-slate-600 tabular-nums">
                    Acuses:{' '}
                    <span data-testid={`acuses-${p.id}`}>
                      {(p.policy_acknowledgments as unknown as unknown[]).length}
                    </span>{' '}
                    de {totalEmpleados ?? 0} empleados
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publicar política</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={subir} className="flex flex-col gap-3 text-sm">
            <ErrorFormulario codigo={errorFormulario} />
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Título
              <input name="titulo" required className={claseCampo} />
            </label>
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Versión
              <input name="version" required className={claseCampo} />
            </label>
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Archivo (PDF)
              <input
                name="archivo"
                type="file"
                accept="application/pdf"
                required
                className={cn(
                  claseCampo,
                  'file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700',
                )}
              />
            </label>
            <p className="text-xs text-slate-500">
              Los empleados verán la política en la página de su cuestionario y registrarán su acuse
              de recibo (evidencia de difusión).
            </p>
            <Button type="submit">Publicar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
