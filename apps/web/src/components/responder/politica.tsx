'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { accionAcusarPolitica } from '@/acciones/responder';
import { Button } from '@/components/ui/button';

export function PoliticaPendiente({
  token,
  policyId,
  titulo,
  version,
  url,
}: {
  token: string;
  policyId: string;
  titulo: string;
  version: string;
  url: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div
      data-testid="politica-pendiente"
      className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-slate-800 shadow-sm"
    >
      <p className="leading-relaxed">
        Tu empresa publicó la <strong>política de prevención de riesgos psicosociales</strong>:{' '}
        {titulo} (versión {version}).
        {url && (
          <>
            {' '}
            <a href={url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
              Consultar documento
            </a>
          </>
        )}
      </p>
      {error && <p className="text-red-700">{error}</p>}
      <Button
        variant="secondary"
        disabled={pendiente}
        data-testid="acusar-politica"
        onClick={() =>
          startTransition(async () => {
            const r = await accionAcusarPolitica(token, policyId);
            if (!r.ok) setError(r.error ?? 'Error');
            else router.refresh();
          })
        }
      >
        {pendiente ? 'Registrando…' : 'He leído la política (acusar recibo)'}
      </Button>
    </div>
  );
}
