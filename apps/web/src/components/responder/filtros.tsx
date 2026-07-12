'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { accionGuardarFiltros } from '@/acciones/responder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function PreguntaSiNo({
  nombre,
  texto,
  valor,
  onCambio,
}: {
  nombre: string;
  texto: string;
  valor: boolean | null;
  onCambio: (v: boolean) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-base font-medium text-slate-900">{texto}</legend>
      <div className="flex gap-3">
        {[
          { etiqueta: 'Sí', v: true },
          { etiqueta: 'No', v: false },
        ].map(({ etiqueta, v }) => (
          <label
            key={etiqueta}
            className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-4 text-center text-base font-medium transition-colors duration-150 ${
              valor === v
                ? 'border-blue-700 bg-blue-50 text-blue-900 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name={nombre}
              value={String(v)}
              checked={valor === v}
              onChange={() => onCambio(v)}
              className="sr-only"
            />
            {etiqueta}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Filtros({ token }: { token: string }) {
  const router = useRouter();
  const [atiende, setAtiende] = useState<boolean | null>(null);
  const [supervisa, setSupervisa] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  return (
    <Card className="shadow-md">
      <CardHeader className="gap-2">
        <CardTitle className="text-xl">Antes de comenzar</CardTitle>
        <p className="text-sm text-slate-500">
          Dos preguntas rápidas para adaptar el cuestionario a tu puesto.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-7">
        <PreguntaSiNo
          nombre="atiende"
          texto="En tu trabajo, ¿atiendes clientes o usuarios?"
          valor={atiende}
          onCambio={setAtiende}
        />
        <PreguntaSiNo
          nombre="supervisa"
          texto="En tu trabajo, ¿eres jefe de otros trabajadores (supervisas personal)?"
          valor={supervisa}
          onCambio={setSupervisa}
        />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button
          size="lg"
          className="w-full"
          disabled={atiende === null || supervisa === null || enviando}
          onClick={() =>
            startTransition(async () => {
              const r = await accionGuardarFiltros(token, atiende === true, supervisa === true);
              if (!r.ok) {
                setError(r.error ?? 'Ocurrió un error');
                return;
              }
              router.refresh();
            })
          }
        >
          {enviando ? 'Guardando…' : 'Comenzar cuestionario'}
        </Button>
      </CardContent>
    </Card>
  );
}
