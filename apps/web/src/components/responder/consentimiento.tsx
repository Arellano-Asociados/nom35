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
  textoAviso,
}: {
  token: string;
  razonSocial: string;
  version: string;
  textoAviso: string;
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
        {/* El texto viene de privacy_notices (archivado, con sha256): NO se hardcodea
            aquí, porque entonces cambiaría con cada despliegue sin que la versión lo
            refleje y no se podría acreditar QUÉ aceptó el titular. */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Aviso de privacidad"
          className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed whitespace-pre-line text-slate-700"
        >
          <p className="mb-2 font-medium text-slate-900">
            Aviso de privacidad de {razonSocial} (versión {version})
          </p>
          {textoAviso}
        </div>
        <p className="text-xs text-slate-600">
          Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición, o revocar
          tu consentimiento, en{' '}
          <a href="/privacidad" className="text-marca-700 underline hover:text-marca-800">
            Tus derechos sobre tus datos
          </a>
          .
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 transition-colors hover:bg-slate-50">
          <input
            type="checkbox"
            checked={aceptado}
            onChange={(e) => setAceptado(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-marca-700"
          />
          <span>
            He leído el aviso de privacidad y otorgo mi <strong>consentimiento expreso</strong> para
            el tratamiento de mis respuestas.
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-peligro">
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
                setError(
                  r.error ??
                    'No pudimos guardar tu consentimiento. Revisa tu conexión e intenta de nuevo.',
                );
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
