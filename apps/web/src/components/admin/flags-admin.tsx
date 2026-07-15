'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPlataforma } from '@/acciones/plataforma';
import { Button } from '@/components/ui/button';

export function FlagToggle({
  flag,
  etiqueta,
  habilitado,
  actualizar,
}: {
  flag: string;
  etiqueta: string;
  /** Valor efectivo actual (fila o default del código). */
  habilitado: boolean;
  actualizar: (flag: string, enabled: boolean) => Promise<ResultadoPlataforma>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div>
        <p className="font-medium text-texto">{etiqueta}</p>
        <p className="text-xs text-texto-secundario">
          <code className="font-mono">{flag}</code> · {habilitado ? 'habilitado' : 'deshabilitado'}
        </p>
        {error && (
          <p role="alert" className="text-xs text-peligro">
            {error}
          </p>
        )}
      </div>
      <Button
        variant={habilitado ? 'outline' : 'secondary'}
        disabled={pendiente}
        data-testid={`flag-${flag}`}
        onClick={() =>
          startTransition(async () => {
            const r = await actualizar(flag, !habilitado);
            if (r.ok) {
              toast.success('Flag actualizado (quedó en ambas bitácoras)');
              setError(null);
              router.refresh();
            } else {
              setError(r.error ?? 'No se pudo actualizar');
              toast.error(r.error ?? 'No se pudo actualizar el flag');
            }
          })
        }
      >
        {habilitado ? 'Deshabilitar' : 'Habilitar'}
      </Button>
    </div>
  );
}
