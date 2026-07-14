'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPanel } from '@/acciones/panel';
import { Button } from '@/components/ui/button';

type Estatus = 'pendiente' | 'en_progreso' | 'completada';

/** Control de avances de una acción del programa (8.4 d): estatus + evidencia. */
export function AccionAvance({
  accionId,
  estatusActual,
  tieneEvidencia,
  actualizar,
  subirEvidencia,
}: {
  accionId: string;
  estatusActual: Estatus;
  tieneEvidencia: boolean;
  actualizar: (accionId: string, estatus: Estatus) => Promise<ResultadoPanel>;
  subirEvidencia: (accionId: string, formData: FormData) => Promise<ResultadoPanel>;
}) {
  const router = useRouter();
  const refArchivo = useRef<HTMLInputElement>(null);
  const [estatus, setEstatus] = useState<Estatus>(estatusActual);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          aria-label="Estatus de la acción"
          value={estatus}
          data-testid={`estatus-${accionId}`}
          onChange={(e) => {
            const nuevo = e.target.value as Estatus;
            setEstatus(nuevo);
            startTransition(async () => {
              const r = await actualizar(accionId, nuevo);
              if (!r.ok) {
                setError(r.error ?? 'No se pudo actualizar el estatus.');
                toast.error(r.error ?? 'No se pudo actualizar el estatus.');
              } else {
                toast.success('Avance registrado');
                router.refresh();
              }
            });
          }}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm shadow-sm"
        >
          <option value="pendiente">Pendiente</option>
          <option value="en_progreso">En progreso</option>
          <option value="completada">Completada</option>
        </select>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const archivo = refArchivo.current?.files?.[0];
            if (!archivo) {
              setError('Elige un archivo PDF o una imagen (PNG/JPG).');
              return;
            }
            const formData = new FormData();
            formData.set('archivo', archivo);
            setError(null);
            startTransition(async () => {
              const r = await subirEvidencia(accionId, formData);
              if (!r.ok) {
                setError(r.error ?? 'No se pudo subir la evidencia.');
                toast.error(r.error ?? 'No se pudo subir la evidencia.');
              } else {
                toast.success(r.detalle?.[0] ?? 'Evidencia adjuntada.');
                if (refArchivo.current) refArchivo.current.value = '';
                router.refresh();
              }
            });
          }}
        >
          <input
            ref={refArchivo}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            aria-label="Evidencia de la acción (PDF o imagen)"
            data-testid={`evidencia-archivo-${accionId}`}
            className="max-w-52 text-xs"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={pendiente}
            data-testid={`evidencia-subir-${accionId}`}
          >
            {tieneEvidencia ? 'Reemplazar evidencia' : 'Adjuntar evidencia'}
          </Button>
        </form>
      </div>
      {error && (
        <p role="alert" className="text-xs text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
