'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPanel } from '@/acciones/panel';
import { Button } from '@/components/ui/button';
import { DialogoConfirmacion } from '@/components/ui/dialogo-confirmacion';

// Selección de los trabajadores EXPUESTOS al acontecimiento (6.5: la GR-I se aplica a
// quienes lo presenciaron o sufrieron, no a todo el centro). La confirmación dice el
// número de correos porque el envío es irreversible.

export interface EmpleadoExpuesto {
  id: string;
  nombre: string;
  yaAsignado: boolean;
}

export function DistribuirEvento({
  empleados,
  distribuir,
}: {
  empleados: EmpleadoExpuesto[];
  distribuir: (empleadoIds: string[]) => Promise<ResultadoPanel>;
}) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const disponibles = empleados.filter((e) => !e.yaAsignado);
  const alternar = (id: string) =>
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  const ejecutar = () =>
    startTransition(async () => {
      const r = await distribuir([...seleccion]);
      if (r.ok) {
        toast.success(r.detalle?.[0] ?? 'Cuestionarios asignados');
        setSeleccion(new Set());
        router.refresh();
      } else {
        toast.error(r.error ?? 'No se pudo aplicar el cuestionario');
      }
    });

  if (disponibles.length === 0)
    return (
      <p className="text-sm text-texto-secundario">
        Todos los trabajadores activos de este centro ya tienen asignada la Guía I de este
        acontecimiento.
      </p>
    );

  return (
    <div className="flex flex-col gap-3" data-testid="distribuir-evento">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-sm font-medium text-texto">
          Trabajadores expuestos al acontecimiento
        </legend>
        {disponibles.map((e) => (
          <label
            key={e.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={seleccion.has(e.id)}
              onChange={() => alternar(e.id)}
              className="h-4 w-4 rounded border-borde text-marca-600 focus:ring-marca-500"
            />
            <span className="text-texto">{e.nombre}</span>
          </label>
        ))}
      </fieldset>

      <Button
        disabled={pendiente || seleccion.size === 0}
        data-testid="aplicar-gr1-evento"
        onClick={() => setConfirmando(true)}
      >
        {pendiente ? 'Procesando…' : 'Aplicar cuestionario a los seleccionados'}
      </Button>

      <DialogoConfirmacion
        abierto={confirmando}
        titulo="Aplicar la Guía I a los seleccionados"
        etiquetaConfirmar="Enviar cuestionarios"
        testid="aplicar-gr1-evento-confirmacion"
        onConfirmar={() => {
          setConfirmando(false);
          ejecutar();
        }}
        onCerrar={() => setConfirmando(false)}
      >
        Se enviarán {seleccion.size} {seleccion.size === 1 ? 'correo' : 'correos'} con el enlace de
        la Guía de Referencia I. El correo no menciona el acontecimiento.
      </DialogoConfirmacion>
    </div>
  );
}
