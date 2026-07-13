import Link from 'next/link';
import type { ReactNode } from 'react';
import { BadgeNivel } from '@/components/panel/badges';
import { TablaDistribucion } from '@/components/panel/tabla-distribucion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { distribucionNiveles, distribucionPorNombre, NIVELES } from '@/lib/agregados';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { resultadosVigentesPorAsignacion } from '@/lib/informe';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface PuntuadoJson {
  nombre: string;
  nivel: string;
}

/** Tile de resumen: metadata + valor grande. Presentación pura, sin datos nuevos. */
function TileResumen({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <p className="text-xs text-slate-500">{etiqueta}</p>
        <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{valor}</p>
      </CardContent>
    </Card>
  );
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
    .select(
      'id, assignment_id, supersedes_id, created_at, nivel_final, categorias, dominios, employees (area)',
    )
    .eq('company_id', empresa)
    .eq('cycle_id', ciclo);

  // Mismo criterio que el informe 7.9 (regla inviolable 1): con cualquier recálculo,
  // el dashboard y el informe deben coincidir en la distribución del mismo ciclo.
  const vigentes = resultadosVigentesPorAsignacion(
    (resultados ?? []).map((r) => ({
      id: r.id,
      assignmentId: r.assignment_id,
      supersedesId: r.supersedes_id,
      createdAt: r.created_at,
      nivel_final: r.nivel_final,
      categorias: r.categorias,
      dominios: r.dominios,
      employees: r.employees,
    })),
  );

  const areas = [
    ...new Set(
      vigentes.map((r) => (r.employees as unknown as { area: string | null }).area ?? 'Sin área'),
    ),
  ].sort();

  const filtrados = vigentes.filter(
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

  // Tiles de resumen: derivados de los objetos que esta página ya calculó arriba (ningún
  // dato nuevo ni consulta adicional). El nivel predominante ignora celdas suprimidas
  // (regla inviolable 3): si todas están suprimidas, no hay uno seguro que mostrar.
  const nivelPredominante = NIVELES.reduce<{ nivel: string; n: number } | null>((mejor, nivel) => {
    const celda = cfinal.celdas[nivel];
    if (celda.suprimida || celda.n === null) return mejor;
    if (!mejor || celda.n > mejor.n) return { nivel, n: celda.n };
    return mejor;
  }, null);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <TileResumen etiqueta="Completados" valor={filtrados.length} />
        <TileResumen
          etiqueta="Áreas cubiertas"
          valor={
            new Set(
              filtrados.map(
                (r) => (r.employees as unknown as { area: string | null }).area ?? 'Sin área',
              ),
            ).size
          }
        />
        <TileResumen
          etiqueta="Nivel predominante"
          valor={
            nivelPredominante ? (
              <BadgeNivel nivel={nivelPredominante.nivel} />
            ) : (
              <span className="text-base font-normal text-slate-600">Sin datos suficientes</span>
            )
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">Filtrar por área:</span>
        <Link
          href={`/panel/${empresa}/ciclos/${ciclo}/dashboard`}
          className={`rounded px-2 py-1 ${!area ? 'bg-marca-100 font-medium text-marca-900' : 'text-marca-700 underline'}`}
        >
          Todas
        </Link>
        {areas.map((a) => (
          <Link
            key={a}
            href={`/panel/${empresa}/ciclos/${ciclo}/dashboard?area=${encodeURIComponent(a)}`}
            className={`rounded px-2 py-1 ${area === a ? 'bg-marca-100 font-medium text-marca-900' : 'text-marca-700 underline'}`}
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
