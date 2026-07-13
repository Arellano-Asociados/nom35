import { BadgeNivel } from '@/components/panel/badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { clienteAdmin } from '@/lib/supabase-admin';

interface PuntuadoJson {
  nombre: string;
  puntaje: number;
  nivel: string;
}

/** Resultado procesado del PROPIO empleado (único dato individual que puede ver). */
export async function Resultado({
  asignacionId,
  guia,
}: {
  asignacionId: string;
  guia: 'GR-I' | 'GR-II' | 'GR-III';
}) {
  const supabase = clienteAdmin();

  if (guia === 'GR-I') {
    const { data } = await supabase
      .from('gr1_results')
      .select('presento_acontecimiento, requiere_valoracion')
      .eq('assignment_id', asignacionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return (
      <Card data-testid="resultado-gr1">
        <CardHeader>
          <CardTitle>Tu resultado</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm leading-relaxed text-slate-800">
          {data.requiere_valoracion ? (
            <div className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50 p-5">
              <p className="font-semibold text-orange-900" data-testid="gr1-requiere">
                Con base en tus respuestas, se recomienda una valoración clínica.
              </p>
              <p className="text-orange-900/80">
                El Responsable Designado de tu centro de trabajo dará seguimiento para canalizarte a
                la atención correspondiente. Esto no es un diagnóstico.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-medium text-emerald-900" data-testid="gr1-no-requiere">
                {data.presento_acontecimiento
                  ? 'Con base en tus respuestas, no se identificó la necesidad de una valoración clínica.'
                  : 'No se identificó exposición a un acontecimiento traumático severo; no se requiere valoración.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const { data } = await supabase
    .from('risk_results')
    .select('cfinal, nivel_final, categorias, dominios')
    .eq('assignment_id', asignacionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const categorias = data.categorias as PuntuadoJson[];
  const dominios = data.dominios as PuntuadoJson[];

  return (
    <Card data-testid="resultado-likert">
      <CardHeader>
        <CardTitle>Tu resultado</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-7">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <span data-testid="nivel-final">
            <BadgeNivel nivel={data.nivel_final} className="px-4 py-1.5 text-base" />
          </span>
          <p className="text-sm font-medium text-slate-600">
            Nivel de riesgo general (calificación final {Number(data.cfinal)})
          </p>
        </div>

        <section aria-label="Resultado por categoría" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Por categoría
          </h3>
          {/* overflow-x-auto: en pantallas angostas la tabla se desplaza dentro de su
              contenedor en vez de romper el layout (WCAG 1.4.10, hallazgo Bajo). */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="py-2 text-left font-medium">Categoría</th>
                  <th className="py-2 pl-4 text-right font-medium">Puntaje</th>
                  <th className="py-2 pl-4 text-right font-medium">Nivel</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((c) => (
                  <tr key={c.nombre} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 text-slate-700">{c.nombre}</td>
                    <td className="py-2.5 pl-4 text-right tabular-nums text-slate-600">
                      {c.puntaje}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      <BadgeNivel nivel={c.nivel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-label="Resultado por dominio" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Por dominio
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="py-2 text-left font-medium">Dominio</th>
                  <th className="py-2 pl-4 text-right font-medium">Puntaje</th>
                  <th className="py-2 pl-4 text-right font-medium">Nivel</th>
                </tr>
              </thead>
              <tbody>
                {dominios.map((d) => (
                  <tr key={d.nombre} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 text-slate-700">{d.nombre}</td>
                    <td className="py-2.5 pl-4 text-right tabular-nums text-slate-600">
                      {d.puntaje}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      <BadgeNivel nivel={d.nivel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-xs leading-relaxed text-slate-500">
          Este es tu resultado individual procesado. Nadie de tu empresa puede ver tus respuestas;
          solo el Responsable Designado puede consultar este resultado y cada consulta queda
          auditada.
        </p>
      </CardContent>
    </Card>
  );
}
