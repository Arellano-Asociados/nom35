'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  OPCIONES_LIKERT5,
  seccionesVisibles,
  type DefinicionCuestionario,
  type PreguntaPersonalizada,
} from '@/lib/cuestionarios';

const ETIQUETA_LIKERT: Record<string, string> = {
  siempre: 'Siempre',
  casi_siempre: 'Casi siempre',
  algunas_veces: 'Algunas veces',
  casi_nunca: 'Casi nunca',
  nunca: 'Nunca',
};

/** Estilo compartido con el cuestionario oficial: cards táctiles ≥44px, foco visible. */
const claseOpcion = (marcada: boolean) =>
  `flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-2 px-3 py-2.5 text-center text-sm transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-marca-500 ${
    marcada
      ? 'border-marca-700 bg-marca-50 font-semibold text-marca-900 shadow-sm'
      : 'border-slate-400 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
  }`;

function Opciones({
  pregunta,
  valor,
  onResponder,
}: {
  pregunta: PreguntaPersonalizada;
  valor?: string;
  onResponder: (preguntaId: string, valor: string) => void;
}) {
  if (pregunta.tipo === 'abierta') {
    return (
      <textarea
        rows={3}
        defaultValue={valor ?? ''}
        maxLength={4000}
        onBlur={(e) => {
          const texto = e.target.value.trim();
          if (texto && texto !== valor) onResponder(pregunta.id, texto);
        }}
        className="w-full rounded-md border border-borde-control bg-white px-3 py-2 text-sm text-texto"
        aria-label={pregunta.texto}
      />
    );
  }

  const opciones =
    pregunta.tipo === 'likert5'
      ? OPCIONES_LIKERT5.map((v) => ({ valor: v, etiqueta: ETIQUETA_LIKERT[v] ?? v }))
      : pregunta.tipo === 'si_no'
        ? [
            { valor: 'si', etiqueta: 'Sí' },
            { valor: 'no', etiqueta: 'No' },
          ]
        : (pregunta.opciones ?? []).map((o) => ({ valor: o, etiqueta: o }));

  const columnas =
    pregunta.tipo === 'likert5' ? 'grid grid-cols-1 gap-2 sm:grid-cols-5' : 'flex flex-wrap gap-2';

  return (
    <div className={columnas}>
      {opciones.map((opcion) => {
        const marcada = valor === opcion.valor;
        return (
          <label key={opcion.valor} className={claseOpcion(marcada)}>
            <input
              type="radio"
              name={pregunta.id}
              value={opcion.valor}
              checked={marcada}
              onChange={() => onResponder(pregunta.id, opcion.valor)}
              className="sr-only"
            />
            {opcion.etiqueta}
          </label>
        );
      })}
    </div>
  );
}

/**
 * Renderizador compartido de cuestionarios personalizados: lo usan la VISTA PREVIA
 * del editor y la página real del empleado, así que la previa es exactamente lo que
 * el empleado verá. Las secciones condicionadas aparecen cuando su condición se
 * cumple (lógica en lib/cuestionarios).
 */
export function RenderCuestionario({
  definicion,
  respuestas,
  onResponder,
}: {
  definicion: DefinicionCuestionario;
  respuestas: Record<string, string>;
  onResponder: (preguntaId: string, valor: string) => void;
}) {
  const visibles = seccionesVisibles(definicion, respuestas);
  if (visibles.length === 0) {
    return (
      <p className="text-sm text-texto-secundario">Este cuestionario aún no tiene contenido.</p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {visibles.map((seccion) => (
        <Card key={seccion.id}>
          <CardHeader>
            <CardTitle as="h3">{seccion.titulo || 'Sección sin título'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {seccion.preguntas.map((pregunta, i) => (
              <fieldset key={pregunta.id} data-testid={`cp-pregunta-${pregunta.id}`}>
                <legend className="mb-3 text-base leading-relaxed font-medium text-slate-900">
                  {i + 1}. {pregunta.texto || 'Pregunta sin texto'}
                </legend>
                <Opciones
                  pregunta={pregunta}
                  valor={respuestas[pregunta.id]}
                  onResponder={onResponder}
                />
              </fieldset>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
