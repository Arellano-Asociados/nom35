import { notFound } from 'next/navigation';
import { AvisoRolSinGestion } from '@/components/panel/aviso-rol';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import {
  preguntasPorId,
  type DefinicionCuestionario,
  type PreguntaPersonalizada,
} from '@/lib/cuestionarios';
import { clienteAdmin } from '@/lib/supabase-admin';
import { clienteSesion } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';

const ETIQUETA_LIKERT: Record<string, string> = {
  siempre: 'Siempre',
  casi_siempre: 'Casi siempre',
  algunas_veces: 'Algunas veces',
  casi_nunca: 'Casi nunca',
  nunca: 'Nunca',
};

function etiquetaDe(pregunta: PreguntaPersonalizada, valor: string): string {
  if (pregunta.tipo === 'likert5') return ETIQUETA_LIKERT[valor] ?? valor;
  if (pregunta.tipo === 'si_no') return valor === 'si' ? 'Sí' : 'No';
  return valor;
}

export default async function PaginaResultadosCuestionario({
  params,
}: {
  params: Promise<{ empresa: string; id: string }>;
}) {
  const { empresa, id } = await params;
  const acceso = await autorizarEmpresa(empresa);
  if (!puedeGestionar(acceso.membresia)) return <AvisoRolSinGestion />;

  const sesion = await clienteSesion();
  const { data: fila } = await sesion
    .from('custom_questionnaires')
    .select('id, title, definition')
    .eq('company_id', empresa)
    .eq('id', id)
    .maybeSingle();
  if (!fila) notFound();
  const definicion = fila.definition as DefinicionCuestionario;
  const preguntas = preguntasPorId(definicion);

  // service_role legítimo (Fase 3, patrón de responses): custom_answers no tiene
  // GRANT para authenticated. Aquí solo se agrega — conteos por opción y textos
  // abiertos SIN identificar a la persona; el reporte se suprime con <3 respuestas.
  const admin = clienteAdmin();
  const [{ data: asignaciones }, { data: respuestas }] = await Promise.all([
    admin
      .from('custom_assignments')
      .select('id, completed_at')
      .eq('company_id', empresa)
      .eq('questionnaire_id', id),
    admin
      .from('custom_answers')
      .select('assignment_id, question_key, answer, answered_at')
      .eq('company_id', empresa)
      .order('answered_at', { ascending: true }),
  ]);

  const idsAsignacion = new Set((asignaciones ?? []).map((a) => a.id));
  const completadas = (asignaciones ?? []).filter((a) => a.completed_at).length;

  // Vigente = última respuesta por (asignación, pregunta); solo de asignaciones COMPLETADAS.
  const completadasIds = new Set(
    (asignaciones ?? []).filter((a) => a.completed_at).map((a) => a.id),
  );
  const vigentes = new Map<string, string>(); // `${asignacion}:${pregunta}` → respuesta
  for (const r of respuestas ?? []) {
    if (!idsAsignacion.has(r.assignment_id) || !completadasIds.has(r.assignment_id)) continue;
    vigentes.set(`${r.assignment_id}:${r.question_key}`, r.answer);
  }

  const conteos = new Map<string, Map<string, number>>(); // pregunta → valor → n
  const abiertas = new Map<string, string[]>(); // pregunta → textos (anónimos)
  for (const [clave, valor] of vigentes) {
    const preguntaId = clave.split(':')[1];
    const pregunta = preguntas.get(preguntaId);
    if (!pregunta) continue;
    if (pregunta.tipo === 'abierta') {
      const lista = abiertas.get(preguntaId) ?? [];
      lista.push(valor);
      abiertas.set(preguntaId, lista);
    } else {
      const porValor = conteos.get(preguntaId) ?? new Map<string, number>();
      porValor.set(valor, (porValor.get(valor) ?? 0) + 1);
      conteos.set(preguntaId, porValor);
    }
  }

  const suprimido = completadas > 0 && completadas < 3;

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        elementos={[
          { etiqueta: 'Cuestionarios', href: `/panel/${empresa}/cuestionarios` },
          { etiqueta: fila.title, href: `/panel/${empresa}/cuestionarios/${id}` },
          { etiqueta: 'Resultados' },
        ]}
      />
      <h2 className="text-xl font-semibold tracking-tight text-texto">Resultados · {fila.title}</h2>
      <p className="text-sm text-texto-secundario tabular-nums">
        {completadas} de {(asignaciones ?? []).length} respondidos.
      </p>

      {completadas === 0 ? (
        <EmptyState
          titulo="Aún no hay respuestas"
          descripcion="Los resultados aparecerán conforme los empleados respondan su enlace."
        />
      ) : suprimido ? (
        <EmptyState
          titulo="Se necesitan al menos 3 respuestas"
          descripcion="Para proteger el anonimato, el reporte se muestra hasta que respondan 3 o más personas (misma regla que el resto de la plataforma)."
          testid="cp-suprimido"
        />
      ) : (
        definicion.secciones.map((seccion) => (
          <Card key={seccion.id}>
            <CardHeader>
              <CardTitle as="h3">{seccion.titulo}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {seccion.preguntas.map((pregunta) => (
                <div key={pregunta.id} className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-texto">{pregunta.texto}</p>
                  {pregunta.tipo === 'abierta' ? (
                    <ul className="flex flex-col gap-1 text-sm text-slate-700">
                      {(abiertas.get(pregunta.id) ?? []).map((texto, i) => (
                        <li key={i} className="rounded-md bg-slate-50 px-3 py-2">
                          {texto}
                        </li>
                      ))}
                      {(abiertas.get(pregunta.id) ?? []).length === 0 && (
                        <li className="text-texto-terciario">Sin respuestas.</li>
                      )}
                    </ul>
                  ) : (
                    <ul className="flex flex-wrap gap-2 text-sm">
                      {[...(conteos.get(pregunta.id) ?? new Map())].map(([valor, n]) => (
                        <li
                          key={valor}
                          className="rounded-full border border-borde bg-slate-50 px-3 py-1 tabular-nums text-slate-700"
                        >
                          {etiquetaDe(pregunta, valor)}: <strong>{n}</strong>
                        </li>
                      ))}
                      {(conteos.get(pregunta.id) ?? new Map()).size === 0 && (
                        <li className="text-texto-terciario">Sin respuestas.</li>
                      )}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
      <p className="text-xs text-texto-secundario">
        Las respuestas se muestran agregadas y las abiertas sin identificar a la persona. Este
        reporte no genera semáforo ni forma parte del informe normativo 7.7.
      </p>
    </div>
  );
}
