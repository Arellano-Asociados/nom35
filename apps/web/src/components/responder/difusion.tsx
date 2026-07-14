'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { accionAcusarDifusion } from '@/acciones/responder';
import { Button } from '@/components/ui/button';

/** Botón de acuse "Enterado" sobre la constancia de difusión (evidencia 5.7 e). */
export function AcusarDifusion({
  token,
  disseminationId,
  acusada,
}: {
  token: string;
  disseminationId: string;
  acusada: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (acusada) {
    return (
      <p data-testid="difusion-acusada" className="text-sm font-medium text-emerald-800">
        Quedó registrado que consultaste estos resultados. Gracias.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}
      <Button
        variant="secondary"
        disabled={pendiente}
        data-testid="acusar-difusion"
        onClick={() =>
          startTransition(async () => {
            const r = await accionAcusarDifusion(token, disseminationId);
            if (!r.ok) setError(r.error ?? 'No se pudo registrar tu acuse. Intenta de nuevo.');
            else router.refresh();
          })
        }
      >
        {pendiente ? 'Registrando…' : 'Enterado: consulté los resultados'}
      </Button>
    </div>
  );
}
