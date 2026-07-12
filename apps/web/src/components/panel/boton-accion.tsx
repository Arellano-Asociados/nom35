'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPanel } from '@/acciones/panel';
import { Button } from '@/components/ui/button';

/** Botón genérico para acciones de servidor del panel que devuelven ResultadoPanel. */
export function BotonAccion({
  etiqueta,
  accion,
  variante = 'default',
  testid,
}: {
  etiqueta: string;
  accion: () => Promise<ResultadoPanel>;
  variante?: 'default' | 'secondary' | 'outline';
  testid?: string;
}) {
  const router = useRouter();
  const [resultado, setResultado] = useState<ResultadoPanel | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={variante}
        disabled={pendiente}
        data-testid={testid}
        onClick={() =>
          startTransition(async () => {
            const r = await accion();
            setResultado(r);
            if (r.ok) {
              toast.success(r.detalle?.[0] ?? `Listo: ${etiqueta}`);
              router.refresh();
            } else {
              toast.error(r.error ?? `No se pudo completar: ${etiqueta}`);
            }
          })
        }
      >
        {pendiente ? 'Procesando…' : etiqueta}
      </Button>
      {resultado?.error && (
        <p role="alert" className="text-sm text-red-700">
          {resultado.error}
        </p>
      )}
      {resultado?.detalle && (
        <ul
          className="text-sm text-slate-600"
          data-testid={testid ? `${testid}-detalle` : undefined}
        >
          {resultado.detalle.map((linea, i) => (
            <li key={i}>{linea}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
