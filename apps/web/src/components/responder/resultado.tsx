import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { clienteAdmin } from '@/lib/supabase-admin';

const ETIQUETA_NIVEL: Record<string, string> = {
  nulo: 'Nulo',
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  muy_alto: 'Muy alto',
};

const COLOR_NIVEL: Record<string, string> = {
  nulo: 'bg-emerald-100 text-emerald-900',
  bajo: 'bg-lime-100 text-lime-900',
  medio: 'bg-yellow-100 text-yellow-900',
  alto: 'bg-orange-100 text-orange-900',
  muy_alto: 'bg-red-100 text-red-900',
};

function Nivel({ nivel }: { nivel: string }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${COLOR_NIVEL[nivel] ?? 'bg-slate-100 text-slate-900'}`}
    >
      {ETIQUETA_NIVEL[nivel] ?? nivel}
    </span>
  );
}

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
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-slate-800">
          {data.requiere_valoracion ? (
            <>
              <p className="font-medium text-orange-900" data-testid="gr1-requiere">
                Con base en tus respuestas, se recomienda una valoración clínica.
              </p>
              <p>
                El Responsable Designado de tu centro de trabajo dará seguimiento para canalizarte a
                la atención correspondiente. Esto no es un diagnóstico.
              </p>
            </>
          ) : (
            <p data-testid="gr1-no-requiere">
              {data.presento_acontecimiento
                ? 'Con base en tus respuestas, no se identificó la necesidad de una valoración clínica.'
                : 'No se identificó exposición a un acontecimiento traumático severo; no se requiere valoración.'}
            </p>
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
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
          <span className="text-sm font-medium text-slate-700">
            Nivel de riesgo general (calificación final {Number(data.cfinal)})
          </span>
          <span data-testid="nivel-final">
            <Nivel nivel={data.nivel_final} />
          </span>
        </div>

        <section aria-label="Resultado por categoría" className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Por categoría</h3>
          {categorias.map((c) => (
            <div key={c.nombre} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-700">{c.nombre}</span>
              <Nivel nivel={c.nivel} />
            </div>
          ))}
        </section>

        <section aria-label="Resultado por dominio" className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Por dominio</h3>
          {dominios.map((d) => (
            <div key={d.nombre} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-700">{d.nombre}</span>
              <Nivel nivel={d.nivel} />
            </div>
          ))}
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
