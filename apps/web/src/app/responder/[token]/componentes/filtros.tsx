'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { accionGuardarFiltros } from '../acciones';

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
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-slate-900">{texto}</legend>
      <div className="flex gap-3">
        {[
          { etiqueta: 'Sí', v: true },
          { etiqueta: 'No', v: false },
        ].map(({ etiqueta, v }) => (
          <label
            key={etiqueta}
            className={`flex-1 cursor-pointer rounded-md border px-4 py-3 text-center text-sm font-medium ${
              valor === v
                ? 'border-blue-700 bg-blue-50 text-blue-900'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
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
    <Card>
      <CardHeader>
        <CardTitle>Antes de comenzar</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
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
