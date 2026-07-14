'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPanel } from '@/acciones/panel';
import type { AccionInicial } from '@/acciones/programa';
import { Button } from '@/components/ui/button';
import { CampoTexto } from '@/components/ui/input';
import { ETIQUETA_NIVEL_ACCION, type AccionPrePoblada } from '@/lib/programa';

// Creación guiada del Programa de intervención (8.4): campos del programa +
// acciones pre-pobladas desde los criterios de la Tabla 4/7, editables y
// descartables ANTES de crear. Nada se escribe hasta confirmar.

interface AccionEditable extends AccionPrePoblada {
  incluida: boolean;
  fecha: string;
}

export function CrearPrograma({
  sugeridas,
  crear,
}: {
  sugeridas: AccionPrePoblada[];
  crear: (datos: {
    areas: string;
    responsable: string;
    acciones: AccionInicial[];
  }) => Promise<ResultadoPanel>;
}) {
  const router = useRouter();
  const [areas, setAreas] = useState('');
  const [responsable, setResponsable] = useState('');
  const [acciones, setAcciones] = useState<AccionEditable[]>(
    sugeridas.map((s) => ({ ...s, incluida: true, fecha: '' })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const editar = (i: number, cambio: Partial<AccionEditable>) =>
    setAcciones((prev) => prev.map((a, j) => (j === i ? { ...a, ...cambio } : a)));

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="crear-programa"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await crear({
            areas,
            responsable,
            acciones: acciones
              .filter((a) => a.incluida)
              .map((a) => ({
                descripcion: a.descripcion,
                nivelAccion: a.nivelAccion,
                nivelOrigen: a.nivelOrigen,
                fecha: a.fecha || null,
              })),
          });
          if (!r.ok) {
            setError(r.error ?? 'No se pudo crear el programa.');
            toast.error(r.error ?? 'No se pudo crear el programa.');
          } else {
            toast.success(r.detalle?.[0] ?? 'Programa creado.');
            router.refresh();
          }
        });
      }}
    >
      <CampoTexto
        etiqueta="Áreas de trabajo y/o trabajadores sujetos al programa (8.4 a)"
        nombre="areas"
        value={areas}
        onChange={(e) => setAreas(e.target.value)}
        required
        data-testid="programa-areas"
      />
      <CampoTexto
        etiqueta="Responsable de la ejecución del programa (8.4 f)"
        nombre="responsable"
        value={responsable}
        onChange={(e) => setResponsable(e.target.value)}
        required
        data-testid="programa-responsable"
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-slate-900">
          Acciones iniciales (pre-pobladas según los criterios de la norma; edítalas o descártalas)
        </legend>
        {acciones.map((a, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={a.incluida}
                onChange={(e) => editar(i, { incluida: e.target.checked })}
                className="mt-1"
              />
              <textarea
                value={a.descripcion}
                onChange={(e) => editar(i, { descripcion: e.target.value })}
                rows={2}
                className="w-full rounded-md border border-slate-300 p-2 text-sm"
                aria-label={`Descripción de la acción ${i + 1}`}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3 pl-6 text-xs text-slate-600">
              {a.nivelAccion && <span>{ETIQUETA_NIVEL_ACCION[a.nivelAccion]}</span>}
              <span>Origen: nivel {a.nivelOrigen.replace('_', ' ')}</span>
              <label className="flex items-center gap-1">
                Fecha programada (8.4 c):
                <input
                  type="date"
                  value={a.fecha}
                  onChange={(e) => editar(i, { fecha: e.target.value })}
                  className="rounded-md border border-slate-300 px-1 py-0.5"
                />
              </label>
            </div>
          </div>
        ))}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pendiente} data-testid="programa-crear">
        {pendiente ? 'Creando…' : 'Crear Programa de intervención'}
      </Button>
    </form>
  );
}
