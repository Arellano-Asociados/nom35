'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { accionEnviarCuestionario, accionGuardarRespuesta } from '@/acciones/responder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface PreguntaUI {
  clave: string;
  seccion: string | null;
  numero: number;
  texto: string;
  /** Encabezado de bloque del DOF que se muestra encima de este ítem (primer ítem del bloque). */
  instruccion?: string | null;
}

export interface SeccionUI {
  id: string;
  titulo: string;
  preguntas: PreguntaUI[];
}

const OPCIONES_LIKERT = [
  { valor: 'siempre', etiqueta: 'Siempre' },
  { valor: 'casi_siempre', etiqueta: 'Casi siempre' },
  { valor: 'algunas_veces', etiqueta: 'Algunas veces' },
  { valor: 'casi_nunca', etiqueta: 'Casi nunca' },
  { valor: 'nunca', etiqueta: 'Nunca' },
];

const OPCIONES_SI_NO = [
  { valor: 'si', etiqueta: 'Sí' },
  { valor: 'no', etiqueta: 'No' },
];

export function Cuestionario({
  token,
  guia,
  secciones,
  respuestasIniciales,
}: {
  token: string;
  guia: 'GR-I' | 'GR-II' | 'GR-III';
  secciones: SeccionUI[];
  respuestasIniciales: Record<string, string>;
}) {
  const router = useRouter();
  const [respuestas, setRespuestas] = useState<Record<string, string>>(respuestasIniciales);
  const [indice, setIndice] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(0);
  const [enviando, startTransition] = useTransition();

  const esGR1 = guia === 'GR-I';
  const opciones = esGR1 ? OPCIONES_SI_NO : OPCIONES_LIKERT;

  // GR-I: si la Sección I está completa y TODAS son "No", el cuestionario termina ahí.
  const seccionI = secciones[0];
  const seccionICompleta =
    esGR1 && (seccionI?.preguntas.every((p) => respuestas[p.clave] !== undefined) ?? false);
  const algunSiEnI =
    esGR1 && (seccionI?.preguntas.some((p) => respuestas[p.clave] === 'si') ?? false);

  const seccionesVisibles = useMemo(() => {
    if (!esGR1) return secciones;
    return algunSiEnI ? secciones : secciones.slice(0, 1);
  }, [esGR1, algunSiEnI, secciones]);

  const indiceSeguro = Math.min(indice, seccionesVisibles.length - 1);
  const seccionActual = seccionesVisibles[indiceSeguro];

  const totalPreguntas = seccionesVisibles.reduce((n, s) => n + s.preguntas.length, 0);
  const contestadas = seccionesVisibles.reduce(
    (n, s) => n + s.preguntas.filter((p) => respuestas[p.clave] !== undefined).length,
    0,
  );
  const completo = contestadas === totalPreguntas && (!esGR1 || seccionICompleta);

  const responder = (pregunta: PreguntaUI, valor: string) => {
    setRespuestas((previas) => ({ ...previas, [pregunta.clave]: valor }));
    setError(null);
    // Guardado incremental: cada respuesta persiste al momento (reconexión no pierde nada).
    // El botón Enviar se bloquea mientras haya guardados en vuelo.
    setGuardando((n) => n + 1);
    void accionGuardarRespuesta(token, pregunta.seccion, pregunta.numero, valor)
      .then((r) => {
        if (!r.ok) setError(r.error ?? 'No se pudo guardar la respuesta');
      })
      .finally(() => setGuardando((n) => n - 1));
  };

  if (!seccionActual) return null;

  const esUltima = indiceSeguro === seccionesVisibles.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="pointer-events-none sticky top-0 z-10 -mx-4 flex flex-col gap-2 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-0 sm:rounded-t-xl">
        <div
          aria-live="polite"
          className="flex items-center justify-between text-sm text-slate-600"
        >
          <span className="font-medium text-slate-800">
            Sección {indiceSeguro + 1} de {seccionesVisibles.length}
          </span>
          <span data-testid="progreso" data-guardando={guardando} className="tabular-nums">
            {contestadas} / {totalPreguntas} respondidas
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={contestadas}
          aria-valuemin={0}
          aria-valuemax={totalPreguntas}
          className="h-2 overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full rounded-full bg-blue-700 transition-all duration-300"
            style={{ width: totalPreguntas ? `${(contestadas / totalPreguntas) * 100}%` : '0%' }}
          />
        </div>
      </div>

      <Card key={seccionActual.id} className="animate-seccion">
        <CardHeader>
          <CardTitle>{seccionActual.titulo}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-7">
          {seccionActual.preguntas.map((pregunta) => (
            <div key={pregunta.clave} className="flex flex-col gap-3">
              {pregunta.instruccion && (
                <p
                  data-testid={`instruccion-${pregunta.clave}`}
                  className="rounded-md bg-slate-100 px-3 py-2 text-sm italic leading-relaxed text-slate-700"
                >
                  {pregunta.instruccion}
                </p>
              )}
              <fieldset data-testid={`pregunta-${pregunta.clave}`}>
                <legend className="mb-3 text-base font-medium leading-relaxed text-slate-900">
                  {pregunta.numero}. {pregunta.texto}
                </legend>
                <div className={esGR1 ? 'flex gap-3' : 'grid grid-cols-1 gap-2 sm:grid-cols-5'}>
                  {opciones.map((opcion) => {
                    const marcada = respuestas[pregunta.clave] === opcion.valor;
                    return (
                      <label
                        key={opcion.valor}
                        // El <input> real es sr-only (1x1 px): el anillo de foco global se
                        // dibujaba sobre un elemento invisible, así que un trabajador que navega
                        // por teclado recorría hasta 360 opciones SIN VER NUNCA dónde estaba el
                        // foco — en la práctica no podía responder (WCAG 2.4.7). `has-focus-visible`
                        // sube el indicador al label, que es lo que se ve.
                        className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-2 text-center transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600 ${
                          esGR1 ? 'flex-1 px-4 py-4 text-base font-medium' : 'px-3 py-2.5 text-sm'
                        } ${
                          marcada
                            ? 'border-blue-700 bg-blue-50 font-semibold text-blue-900 shadow-sm'
                            : 'border-slate-400 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={pregunta.clave}
                          value={opcion.valor}
                          checked={marcada}
                          onChange={() => responder(pregunta, opcion.valor)}
                          className="sr-only"
                        />
                        {opcion.etiqueta}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={indiceSeguro === 0}
          onClick={() => setIndice(indiceSeguro - 1)}
        >
          Anterior
        </Button>
        {!esUltima ? (
          <Button className="flex-1" onClick={() => setIndice(indiceSeguro + 1)}>
            Siguiente
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={!completo || enviando || guardando > 0}
            data-testid="enviar"
            onClick={() =>
              startTransition(async () => {
                const r = await accionEnviarCuestionario(token);
                if (!r.ok) {
                  setError(r.error ?? 'No se pudo enviar el cuestionario');
                  return;
                }
                router.refresh();
              })
            }
          >
            {enviando ? 'Enviando…' : 'Enviar cuestionario'}
          </Button>
        )}
      </div>
    </div>
  );
}
