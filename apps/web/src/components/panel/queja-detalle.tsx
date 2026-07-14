'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { accionActualizarQueja } from '@/acciones/buzon';
import { Button } from '@/components/ui/button';
import { CampoSelect, CampoTexto } from '@/components/ui/input';
import { ESTADOS_QUEJA } from '@/lib/buzon';

/** Seguimiento de una queja (8.2 g): cambio de estado con nota obligatoria. */
export function CambiarEstadoQueja({
  companyId,
  quejaId,
  estadoActual,
}: {
  companyId: string;
  quejaId: string;
  estadoActual: string;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const opciones = Object.entries(ESTADOS_QUEJA).filter(([valor]) => valor !== estadoActual);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await accionActualizarQueja(companyId, quejaId, estado, nota);
          if (!r.ok) {
            setError(r.error ?? 'No se pudo guardar el cambio.');
            toast.error(r.error ?? 'No se pudo guardar el cambio.');
          } else {
            toast.success(r.detalle?.[0] ?? 'Estado actualizado.');
            setNota('');
            setEstado('');
            router.refresh();
          }
        });
      }}
    >
      <CampoSelect
        etiqueta="Nuevo estado"
        nombre="estado"
        value={estado}
        onChange={(e) => setEstado(e.target.value)}
        required
        data-testid="queja-nuevo-estado"
      >
        <option value="">Elige un estado…</option>
        {opciones.map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </CampoSelect>
      <CampoTexto
        etiqueta="Nota de seguimiento (qué se hizo o qué sigue)"
        nombre="nota"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        required
        error={error ?? undefined}
        data-testid="queja-nota"
      />
      <Button type="submit" disabled={pendiente} data-testid="queja-guardar-estado">
        {pendiente ? 'Guardando…' : 'Guardar seguimiento'}
      </Button>
    </form>
  );
}
