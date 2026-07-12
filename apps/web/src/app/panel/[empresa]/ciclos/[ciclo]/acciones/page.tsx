import { accionCrearAccion } from '@/acciones/panel';
import { BadgeNivel } from '@/components/panel/badges';
import { claseCampo, claseEstadoVacio } from '@/components/panel/campos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { distribucionPorNombre } from '@/lib/agregados';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { resultadosVigentesPorAsignacion } from '@/lib/informe';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const NIVELES_ACCION = ['medio', 'alto', 'muy_alto'] as const;

interface PuntuadoJson {
  nombre: string;
  nivel: string;
}

export default async function PaginaAcciones({
  params,
}: {
  params: Promise<{ empresa: string; ciclo: string }>;
}) {
  const { empresa, ciclo } = await params;
  await autorizarEmpresa(empresa);

  const supabase = clienteAdmin();
  const [{ data: acciones }, { data: resultados }, { data: config }] = await Promise.all([
    supabase
      .from('action_items')
      .select('id, description, origin_level, responsible, due_date, status')
      .eq('company_id', empresa)
      .eq('cycle_id', ciclo)
      .order('created_at'),
    supabase
      .from('risk_results')
      .select('id, assignment_id, supersedes_id, created_at, categorias')
      .eq('company_id', empresa)
      .eq('cycle_id', ciclo),
    supabase.from('system_config').select('value').eq('key', 'sugerencias_tabla7').maybeSingle(),
  ]);

  // Mismo criterio que el dashboard y el informe 7.9 (regla inviolable 1): con cualquier
  // recálculo, las sugerencias de la Tabla 7 deben basarse solo en la fila VIGENTE por
  // asignación, nunca en el historial completo (que incluiría filas superadas).
  const vigentes = resultadosVigentesPorAsignacion(
    (resultados ?? []).map((r) => ({
      id: r.id,
      assignmentId: r.assignment_id,
      supersedesId: r.supersedes_id,
      createdAt: r.created_at,
      categorias: r.categorias,
    })),
  );

  // Categorías con nivel medio+ en el ciclo → sugerencias automáticas (Tabla 7)
  const porCategoria = distribucionPorNombre(
    vigentes.flatMap((r) =>
      (r.categorias as PuntuadoJson[]).map((c) => ({ nombre: c.nombre, nivel: c.nivel })),
    ),
  );
  const sugerencias = (config?.value ?? {}) as Record<string, string[]>;
  const categoriasEnRiesgo = [...porCategoria.entries()]
    .filter(([, dist]) =>
      NIVELES_ACCION.some((nivel) => {
        const celda = dist.celdas[nivel];
        return celda.suprimida || (celda.n ?? 0) > 0;
      }),
    )
    .map(([nombre]) => nombre);

  const crear = accionCrearAccion.bind(null, empresa, ciclo);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Acciones registradas (Capítulo 8)</CardTitle>
          </CardHeader>
          <CardContent>
            {(acciones ?? []).length === 0 ? (
              <p className={claseEstadoVacio}>
                Aún no hay acciones registradas. Registra la primera con el formulario.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm" data-testid="lista-acciones">
                {(acciones ?? []).map((a) => (
                  <li key={a.id} className="rounded-md border border-slate-200 px-4 py-3">
                    <p className="font-medium text-slate-900">{a.description}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-slate-600">
                      <span>Nivel de origen:</span>
                      <BadgeNivel nivel={a.origin_level} />
                      <span>· Responsable: {a.responsible} ·</span>
                      <span>{a.due_date ?? 'sin fecha'}</span>
                      <span>· {a.status}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sugerencias (referencia Tabla 7) para niveles medio o superiores</CardTitle>
          </CardHeader>
          <CardContent>
            {categoriasEnRiesgo.length === 0 ? (
              <p className={claseEstadoVacio}>
                No hay categorías con nivel medio o superior en este ciclo.
              </p>
            ) : (
              <div className="flex flex-col gap-3 text-sm" data-testid="sugerencias-tabla7">
                {categoriasEnRiesgo.map((categoria) => (
                  <div key={categoria}>
                    <p className="font-medium text-slate-900">{categoria}</p>
                    <ul className="list-disc pl-5 text-slate-700">
                      {(sugerencias[categoria] ?? []).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrar acción</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={crear} className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Descripción
              <textarea name="descripcion" required rows={3} className={claseCampo} />
            </label>
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Nivel de riesgo de origen
              <select name="nivel" required className={claseCampo}>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
                <option value="muy_alto">Muy alto</option>
                <option value="bajo">Bajo</option>
                <option value="nulo">Nulo</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Responsable
              <input name="responsable" required className={claseCampo} />
            </label>
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Fecha compromiso
              <input name="fecha" type="date" className={claseCampo} />
            </label>
            <Button type="submit">Registrar acción</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
