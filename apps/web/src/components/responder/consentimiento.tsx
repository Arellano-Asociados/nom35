'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { accionRegistrarConsentimiento } from '@/acciones/responder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Consentimiento({
  token,
  razonSocial,
  version,
}: {
  token: string;
  razonSocial: string;
  version: string;
}) {
  const router = useRouter();
  const [aceptado, setAceptado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  return (
    <Card className="shadow-md">
      <CardHeader className="gap-2">
        <CardTitle className="text-xl">Aviso de privacidad y consentimiento</CardTitle>
        <p className="text-sm text-slate-500">
          Antes de comenzar, necesitamos tu consentimiento para tratar tus respuestas conforme a la
          NOM-035-STPS-2018.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
          <p className="mb-2 font-medium text-slate-900">
            Aviso de privacidad de {razonSocial} (versión {version})
          </p>
          <p className="mb-2">
            Tus respuestas a este cuestionario son <strong>datos personales sensibles</strong> y se
            tratan conforme a la Ley Federal de Protección de Datos Personales en Posesión de los
            Particulares (LFPDPPP) con la única finalidad de cumplir la NOM-035-STPS-2018.
          </p>
          <p className="mb-2">
            Nadie de tu empresa puede ver tus respuestas individuales. Tu resultado procesado solo
            es visible para el Responsable Designado, y cada consulta queda auditada.
          </p>
          <p>Al aceptar, otorgas tu consentimiento expreso para este tratamiento.</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 transition-colors hover:bg-slate-50">
          <input
            type="checkbox"
            checked={aceptado}
            onChange={(e) => setAceptado(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-blue-700"
          />
          <span>
            He leído el aviso de privacidad y otorgo mi <strong>consentimiento expreso</strong> para
            el tratamiento de mis respuestas.
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button
          size="lg"
          className="w-full"
          disabled={!aceptado || enviando}
          onClick={() =>
            startTransition(async () => {
              const r = await accionRegistrarConsentimiento(token);
              if (!r.ok) {
                setError(r.error ?? 'Ocurrió un error');
                return;
              }
              router.refresh();
            })
          }
        >
          {enviando ? 'Registrando…' : 'Aceptar y continuar'}
        </Button>
      </CardContent>
    </Card>
  );
}
