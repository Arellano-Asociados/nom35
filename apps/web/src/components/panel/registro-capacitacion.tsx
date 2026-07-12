'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPanel } from '@/acciones/panel';
import { Button } from '@/components/ui/button';

export function RegistroCapacitacion({
  trainingId,
  empleados,
  registrar,
}: {
  trainingId: string;
  empleados: { id: string; nombre: string; completado: boolean }[];
  registrar: (trainingId: string, employeeIds: string[]) => Promise<ResultadoPanel>;
}) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [pendiente, startTransition] = useTransition();

  const alternar = (id: string) => {
    setSeleccion((previa) => {
      const nueva = new Set(previa);
      if (nueva.has(id)) nueva.delete(id);
      else nueva.add(id);
      return nueva;
    });
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
        {empleados.map((e) => (
          <li key={e.id}>
            <label className="flex items-center gap-2 text-slate-800">
              <input
                type="checkbox"
                disabled={e.completado}
                checked={e.completado || seleccion.has(e.id)}
                onChange={() => alternar(e.id)}
              />
              {e.nombre}
              {e.completado && <span className="text-xs text-emerald-700">(completada)</span>}
            </label>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        disabled={pendiente || seleccion.size === 0}
        onClick={() =>
          startTransition(async () => {
            const r = await registrar(trainingId, [...seleccion]);
            if (r.ok) {
              toast.success(r.detalle?.[0] ?? 'Capacitación registrada');
              setSeleccion(new Set());
              router.refresh();
            } else {
              toast.error(r.error ?? 'No se pudo registrar la capacitación');
            }
          })
        }
      >
        {pendiente ? 'Registrando…' : 'Marcar capacitación completada'}
      </Button>
    </div>
  );
}
