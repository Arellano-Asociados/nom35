import Link from 'next/link';
import { accionCrearCiclo } from '@/acciones/panel';
import { ErrorFormulario } from '@/components/panel/error-formulario';
import { claseCampo, claseEstadoVacio } from '@/components/panel/campos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function PaginaCiclos({
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
  const [{ data: ciclos }, { data: centros }, { data: alertas }] = await Promise.all([
    supabase
      .from('compliance_cycles')
      .select('id, name, date_start, date_end, evaluator_name, work_centers (name)')
      .eq('company_id', empresa)
      .order('date_start', { ascending: false }),
    supabase.from('work_centers').select('id, name').eq('company_id', empresa).order('name'),
    supabase
      .from('work_centers_alerta_ciclo')
      .select('work_center_id, name, requiere_nueva_evaluacion')
      .eq('company_id', empresa),
  ]);

  const crear = accionCrearCiclo.bind(null, empresa);
  const vencidos = (alertas ?? []).filter((a) => a.requiere_nueva_evaluacion);

  return (
    <div className="flex flex-col gap-4">
      {vencidos.length > 0 && (
        <p
          role="status"
          data-testid="alerta-24-meses"
          className="rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-900"
        >
          Atención (numeral 7.9): {vencidos.map((v) => v.name).join(', ')} sin evaluación en los
          últimos 24 meses.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ciclos de evaluación</CardTitle>
          </CardHeader>
          <CardContent>
            {(ciclos ?? []).length === 0 && (
              <p className={claseEstadoVacio}>
                Aún no hay ciclos de evaluación. Crea el primero con el formulario.
              </p>
            )}
            <ul className="flex flex-col gap-2" data-testid="lista-ciclos">
              {(ciclos ?? []).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/panel/${empresa}/ciclos/${c.id}`}
                    className="block rounded-md border border-slate-200 px-4 py-3 text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">{c.name}</span>{' '}
                    <span className="text-slate-500">
                      · {(c.work_centers as unknown as { name: string }).name} · inicia{' '}
                      {c.date_start}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo ciclo</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={crear} className="flex flex-col gap-3 text-sm">
              <ErrorFormulario codigo={errorFormulario} />
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Nombre del ciclo
                <input name="nombre" required className={claseCampo} />
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
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 font-medium text-slate-800">
                  Fecha de inicio
                  <input name="inicio" type="date" required className={claseCampo} />
                </label>
                <label className="flex flex-col gap-1 font-medium text-slate-800">
                  Fecha de fin
                  <input name="fin" type="date" className={claseCampo} />
                </label>
              </div>
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Nombre del evaluador
                <input name="evaluador" required className={claseCampo} />
              </label>
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Cédula profesional del evaluador
                <input name="cedula" required className={claseCampo} />
              </label>
              <p className="text-xs text-slate-500">
                Las guías a aplicar se seleccionan automáticamente según la categoría normativa del
                centro.
              </p>
              <Button type="submit">Crear ciclo</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
