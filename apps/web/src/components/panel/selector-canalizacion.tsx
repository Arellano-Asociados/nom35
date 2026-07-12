'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPanel } from '@/acciones/panel';

type Estatus = 'pendiente' | 'canalizado' | 'atendido';

export function SelectorCanalizacion({
  gr1Id,
  estatusActual,
  actualizar,
}: {
  gr1Id: string;
  estatusActual: Estatus;
  actualizar: (gr1Id: string, estatus: Estatus, fecha: string | null) => Promise<ResultadoPanel>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label="Estatus de canalización"
        defaultValue={estatusActual}
        data-testid={`canalizacion-${gr1Id}`}
        onChange={(e) =>
          startTransition(async () => {
            const estatus = e.target.value as Estatus;
            const fecha = estatus === 'pendiente' ? null : new Date().toISOString().slice(0, 10);
            const r = await actualizar(gr1Id, estatus, fecha);
            if (!r.ok) {
              setError(r.error ?? 'Error');
              toast.error(r.error ?? 'No se pudo actualizar la canalización');
            } else {
              toast.success('Canalización actualizada');
              router.refresh();
            }
          })
        }
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      >
        <option value="pendiente">Pendiente</option>
        <option value="canalizado">Canalizado</option>
        <option value="atendido">Atendido</option>
      </select>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
