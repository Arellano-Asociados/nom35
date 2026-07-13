'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPanel } from '@/acciones/panel';
import { BadgeEstadoCanalizacion } from '@/components/panel/badges';

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
  const [estatus, setEstatus] = useState<Estatus>(estatusActual);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <BadgeEstadoCanalizacion estatus={estatus} />
        <select
          aria-label="Estatus de canalización"
          value={estatus}
          data-testid={`canalizacion-${gr1Id}`}
          onChange={(e) => {
            const nuevoEstatus = e.target.value as Estatus;
            setEstatus(nuevoEstatus);
            startTransition(async () => {
              const fecha =
                nuevoEstatus === 'pendiente' ? null : new Date().toISOString().slice(0, 10);
              const r = await actualizar(gr1Id, nuevoEstatus, fecha);
              if (!r.ok) {
                setError(r.error ?? 'Error');
                toast.error(r.error ?? 'No se pudo actualizar la canalización');
              } else {
                toast.success('Canalización actualizada');
                router.refresh();
              }
            });
          }}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm shadow-sm transition-colors hover:border-slate-400"
        >
          <option value="pendiente">Pendiente</option>
          <option value="canalizado">Canalizado</option>
          <option value="atendido">Atendido</option>
        </select>
      </div>
      {error && <p className="text-xs text-peligro">{error}</p>}
    </div>
  );
}
