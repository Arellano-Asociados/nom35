import Link from 'next/link';
import { TablaDistribucion } from '@/components/panel/tabla-distribucion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { distribucionNiveles, distribucionPorNombre } from '@/lib/agregados';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface PuntuadoJson {
  nombre: string;
  nivel: string;
}

export default async function PaginaDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string; ciclo: string }>;
  searchParams: Promise<{ area?: string }>;
}) {
  const { empresa, ciclo } = await params;
  const { area } = await searchParams;
  await autorizarEmpresa(empresa);

  // Agregación en el servidor (el rol patronal no tiene SELECT sobre risk_results):
  // solo distribuciones y conteos llegan a la UI, jamás resultados individuales.
  const supabase = clienteAdmin();
  const { data: resultados } = await supabase
    .from('risk_results')
    .select('nivel_final, categorias, dominios, employees (area)')
    .eq('company_id', empresa)
    .eq('cycle_id', ciclo);

  const areas = [
    ...new Set(
      (resultados ?? []).map(
        (r) => (r.employees as unknown as { area: string | null }).area ?? 'Sin área',
      ),
    ),
  ].sort();

  const filtrados = (resultados ?? []).filter(
    (r) =>
      !area || ((r.employees as unknown as { area: string | null }).area ?? 'Sin área') === area,
  );

  const cfinal = distribucionNiveles(filtrados.map((r) => r.nivel_final));
  const categorias = distribucionPorNombre(
    filtrados.flatMap((r) =>
      (r.categorias as PuntuadoJson[]).map((c) => ({ nombre: c.nombre, nivel: c.nivel })),
    ),
  );
  const dominios = distribucionPorNombre(
    filtrados.flatMap((r) =>
      (r.dominios as PuntuadoJson[]).map((d) => ({ nombre: d.nombre, nivel: d.nivel })),
    ),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">Filtrar por área:</span>
        <Link
          href={`/panel/${empresa}/ciclos/${ciclo}/dashboard`}
          className={`rounded px-2 py-1 ${!area ? 'bg-blue-100 font-medium text-blue-900' : 'text-blue-700 underline'}`}
        >
          Todas
        </Link>
        {areas.map((a) => (
          <Link
            key={a}
            href={`/panel/${empresa}/ciclos/${ciclo}/dashboard?area=${encodeURIComponent(a)}`}
            className={`rounded px-2 py-1 ${area === a ? 'bg-blue-100 font-medium text-blue-900' : 'text-blue-700 underline'}`}
          >
            {a}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calificación final del cuestionario</CardTitle>
        </CardHeader>
        <CardContent>
          <TablaDistribucion
            testid="dist-cfinal"
            filas={[{ nombre: 'Cfinal', distribucion: cfinal }]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <TablaDistribucion
            testid="dist-categorias"
            filas={[...categorias.entries()].map(([nombre, distribucion]) => ({
              nombre,
              distribucion,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por dominio</CardTitle>
        </CardHeader>
        <CardContent>
          <TablaDistribucion
            testid="dist-dominios"
            filas={[...dominios.entries()].map(([nombre, distribucion]) => ({
              nombre,
              distribucion,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
