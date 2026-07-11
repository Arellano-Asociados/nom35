'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { accionEnviarCuestionario, accionGuardarRespuesta } from '@/acciones/responder';

export interface PreguntaUI {
  clave: string;
  seccion: string | null;
  numero: number;
  texto: string;
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
  { valor: 'si', etiqueta: 'SÃ­' },
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

  // GR-I: si la SecciÃ³n I estÃ¡ completa y TODAS son "No", el cuestionario termina ahÃ­.
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
    // Guardado incremental: cada respuesta persiste al momento (reconexiÃ³n no pierde nada).
    // El botÃ³n Enviar se bloquea mientras haya guardados en vuelo.
    setGuardando((n) => n + 1);
    void accionGuardarRespuesta(token, pregunta.seccion, pregunta.numero, valor)
      .then((r) => {
        if (!r.ok) setError(r.error ?? 'No se pudo guardar la respuesta');
      })
      .finally(() => setGuardando((n) => n - 1));
  };

  if (!seccionActual) return null;

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite" className="flex items-center justify-between text-sm text-slate-600">
        <span>
          SecciÃ³n {indiceSeguro + 1} de {seccionesVisibles.length}
        </span>
        <span data-testid="progreso">
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
          className="h-full bg-blue-700 transition-all"
          style={{ width: totalPreguntas ? `${(contestadas / totalPreguntas) * 100}%` : '0%' }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{seccionActual.titulo}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {seccionActual.preguntas.map((pregunta) => (
            <fieldset key={pregunta.clave} data-testid={`pregunta-${pregunta.clave}`}>
              <legend className="mb-2 text-sm font-medium leading-relaxed text-slate-900">
                {pregunta.numero}. {pregunta.texto}
              </legend>
              <div className={esGR1 ? 'flex gap-2' : 'grid grid-cols-1 gap-2 sm:grid-cols-5'}>
                {opciones.map((opcion) => {
                  const marcada = respuestas[pregunta.clave] === opcion.valor;
                  return (
                    <label
                      key={opcion.valor}
                      className={`cursor-pointer rounded-md border px-3 py-2.5 text-center text-sm ${
                        esGR1 ? 'flex-1' : ''
                      } ${
                        marcada
                          ? 'border-blue-700 bg-blue-50 font-medium text-blue-900'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
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
          ))}
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={indiceSeguro === 0}
          onClick={() => setIndice(indiceSeguro - 1)}
        >
          Anterior
        </Button>
        {indiceSeguro < seccionesVisibles.length - 1 ? (
          <Button onClick={() => setIndice(indiceSeguro + 1)}>Siguiente</Button>
        ) : (
          <Button
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
            {enviando ? 'Enviandoâ€¦' : 'Enviar cuestionario'}
          </Button>
        )}
      </div>
    </div>
  );
}
