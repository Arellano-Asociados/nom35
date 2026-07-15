import Link from 'next/link';
import type { ReactNode } from 'react';
import { BadgeNivel } from '@/components/panel/badges';
import { TablaDistribucion } from '@/components/panel/tabla-distribucion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { distribucionNiveles, distribucionPorNombre, NIVELES } from '@/lib/agregados';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteSesion } from '@/lib/supabase-servidor';
import { vigentesDeCiclo } from '@/lib/tablero-datos';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Tile de resumen: metadata + valor grande. Presentación pura, sin datos nuevos. */
function TileResumen({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <p className="text-xs text-texto-secundario">{etiqueta}</p>
        <p className="text-2xl font-semibold tracking-tight text-texto tabular-nums">{valor}</p>
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

  // Vigencia + agregación en un solo lugar (lib/tablero-datos, service_role): el rol
  // patronal no tiene SELECT sobre risk_results; solo distribuciones y conteos llegan a
  // la UI, jamás resultados individuales. El dashboard ejecutivo usa la misma fuente.
  const { count: totalAsignaciones } = await (
    await clienteSesion()
  )
    .from('questionnaire_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', empresa)
    .eq('cycle_id', ciclo);

  const vigentes = await vigentesDeCiclo(empresa, ciclo);

  const areas = [...new Set(vigentes.map((r) => r.area))].sort();
  const filtrados = vigentes.filter((r) => !area || r.area === area);

  const cfinal = distribucionNiveles(filtrados.map((r) => r.nivelFinal));
  const categorias = distribucionPorNombre(
    filtrados.flatMap((r) => r.categorias.map((c) => ({ nombre: c.nombre, nivel: c.nivel }))),
  );
  const dominios = distribucionPorNombre(
    filtrados.flatMap((r) => r.dominios.map((d) => ({ nombre: d.nombre, nivel: d.nivel }))),
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

  // Participación del CICLO completo (no del filtro): respondidos vigentes / asignados.
  const participacion =
    totalAsignaciones && totalAsignaciones > 0
      ? Math.round((vigentes.length / totalAsignaciones) * 100)
      : null;

  if (vigentes.length === 0) {
    return (
      <EmptyState
        titulo="Aún no hay resultados en este ciclo"
        descripcion="El dashboard agregado se llena conforme los empleados responden su cuestionario; nunca muestra respuestas individuales, solo distribuciones y conteos. Distribuye los cuestionarios o envía recordatorios desde el Resumen."
        cta={
          <Link
            href={`/panel/${empresa}/ciclos/${ciclo}`}
            className="text-sm font-medium text-marca-700 underline hover:text-marca-800"
          >
            Ir al Resumen del ciclo
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TileResumen
          etiqueta="Participación del ciclo"
          valor={participacion === null ? '—' : `${participacion}%`}
        />
        <TileResumen etiqueta="Completados" valor={filtrados.length} />
        <TileResumen
          etiqueta="Áreas cubiertas"
          valor={new Set(filtrados.map((r) => r.area)).size}
        />
        <TileResumen
          etiqueta="Nivel predominante"
          valor={
            nivelPredominante ? (
              <BadgeNivel nivel={nivelPredominante.nivel} />
            ) : (
              <span className="text-base font-normal text-texto-secundario">
                Sin datos suficientes
              </span>
            )
          }
        />
      </div>

      <nav aria-label="Filtrar por área" className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-texto-secundario">Filtrar por área:</span>
        <Link
          href={`/panel/${empresa}/ciclos/${ciclo}/dashboard`}
          aria-current={!area ? 'true' : undefined}
          className={cn(
            'rounded-full px-3 py-1 transition-colors',
            !area
              ? 'bg-marca-100 font-medium text-marca-900'
              : 'text-marca-700 underline hover:text-marca-800',
          )}
        >
          Todas
        </Link>
        {areas.map((a) => (
          <Link
            key={a}
            href={`/panel/${empresa}/ciclos/${ciclo}/dashboard?area=${encodeURIComponent(a)}`}
            aria-current={area === a ? 'true' : undefined}
            className={cn(
              'rounded-full px-3 py-1 transition-colors',
              area === a
                ? 'bg-marca-100 font-medium text-marca-900'
                : 'text-marca-700 underline hover:text-marca-800',
            )}
          >
            {a}
          </Link>
        ))}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>Calificación final del cuestionario</CardTitle>
        </CardHeader>
        <CardContent>
          <TablaDistribucion
            testid="dist-cfinal"
            filas={[{ nombre: 'Calificación final', distribucion: cfinal }]}
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

      <p className="text-xs text-texto-secundario">
        Las celdas con menos de 3 personas se ocultan (y con ellas su fila completa) para proteger
        el anonimato. Este panel nunca muestra resultados individuales.
      </p>
    </div>
  );
}
