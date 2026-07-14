'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { accionEnviarEncuesta, accionGuardarRespuestaEncuesta } from '@/acciones/encuesta';
import { RenderCuestionario } from '@/components/cuestionarios/render-cuestionario';
import { Button } from '@/components/ui/button';
import {
  preguntasPorId,
  seccionesVisibles,
  type DefinicionCuestionario,
} from '@/lib/cuestionarios';

/**
 * Página de respuesta del empleado para cuestionarios personalizados: mismo
 * renderizador que la vista previa del editor, guardado incremental por respuesta
 * (reconexión no pierde nada) y envío cuando lo visible está completo.
 */
export function EncuestaCliente({
  token,
  definicion,
  respuestasIniciales,
}: {
  token: string;
  definicion: DefinicionCuestionario;
  respuestasIniciales: Record<string, string>;
}) {
  const router = useRouter();
  const [respuestas, setRespuestas] = useState(respuestasIniciales);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(0);
  const [enviando, startTransition] = useTransition();

  const visibles = seccionesVisibles(definicion, respuestas);
  const totalPreguntas = visibles.reduce((n, s) => n + s.preguntas.length, 0);
  const contestadas = visibles.reduce(
    (n, s) => n + s.preguntas.filter((p) => respuestas[p.id] !== undefined).length,
    0,
  );
  const completo = totalPreguntas > 0 && contestadas === totalPreguntas;

  const preguntas = useMemo(() => preguntasPorId(definicion), [definicion]);

  const responder = (preguntaId: string, valor: string) => {
    if (!preguntas.has(preguntaId)) return;
    setRespuestas((r) => ({ ...r, [preguntaId]: valor }));
    setError(null);
    setGuardando((n) => n + 1);
    void accionGuardarRespuestaEncuesta(token, preguntaId, valor)
      .then((r) => {
        if (!r.ok) setError(r.error ?? 'No se pudo guardar la respuesta');
      })
      .finally(() => setGuardando((n) => n - 1));
  };

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite" className="flex items-center justify-between text-sm text-slate-600">
        <span className="tabular-nums" data-testid="cp-progreso" data-guardando={guardando}>
          {contestadas} / {totalPreguntas} respondidas
        </span>
        {contestadas > 0 && (
          <span className="text-xs text-texto-secundario">
            {guardando > 0 ? 'Guardando…' : 'Guardado ✓'}
          </span>
        )}
      </div>

      <RenderCuestionario definicion={definicion} respuestas={respuestas} onResponder={responder} />

      {error && (
        <p role="alert" className="rounded-md bg-peligro-fondo p-3 text-sm text-peligro-texto">
          {error}
        </p>
      )}

      <Button
        disabled={!completo || enviando || guardando > 0}
        data-testid="cp-enviar"
        onClick={() =>
          startTransition(async () => {
            const r = await accionEnviarEncuesta(token);
            if (!r.ok) {
              setError(r.error ?? 'No se pudo enviar');
              return;
            }
            router.refresh();
          })
        }
      >
        {enviando ? 'Procesando…' : 'Enviar respuestas'}
      </Button>
    </div>
  );
}
