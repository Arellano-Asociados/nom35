'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoSoporte } from '@/acciones/soporte-tenant';
import { claseCampo } from '@/components/panel/campos';
import { Button } from '@/components/ui/button';
import { DialogoConfirmacion } from '@/components/ui/dialogo-confirmacion';

/**
 * Formulario de otorgamiento (spec §6.3): llega PRE-LLENADO desde el deep link del
 * correo, pero el admin ve operador, alcance y duración ANTES de confirmar, y la
 * confirmación ocurre SIEMPRE aquí, con su sesión — nunca desde el correo.
 */
export function OtorgarAcceso({
  operadorId,
  operadorEmail,
  horasIniciales,
  motivoInicial,
  otorgar,
}: {
  operadorId: string;
  operadorEmail: string;
  horasIniciales: number;
  motivoInicial: string;
  otorgar: (operadorId: string, horas: number, motivo: string) => Promise<ResultadoSoporte>;
}) {
  const router = useRouter();
  const [horas, setHoras] = useState(String(horasIniciales));
  const [motivo, setMotivo] = useState(motivoInicial);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        Operador que tendrá acceso:{' '}
        <span className="font-medium" data-testid="soporte-operador-email">
          {operadorEmail}
        </span>
      </p>
      <p className="text-texto-secundario">
        Alcance: <strong>solo lectura</strong> de la estructura de tu organización (centros,
        empleados y su estado de participación, ciclos con conteos, flags, constancias y bitácora).{' '}
        <strong>Nunca</strong> respuestas de cuestionarios, resultados individuales ni contenido de
        quejas. Cada página que consulte queda registrada en tu bitácora.
      </p>
      <label className="flex flex-col gap-1 font-medium text-slate-800">
        Duración (horas, máximo 72)
        <input
          type="number"
          min={1}
          max={72}
          value={horas}
          onChange={(e) => setHoras(e.target.value)}
          data-testid="soporte-horas"
          className={claseCampo}
        />
      </label>
      <label className="flex flex-col gap-1 font-medium text-slate-800">
        Motivo
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          data-testid="soporte-motivo"
          className={claseCampo}
        />
      </label>
      <Button
        disabled={pendiente || motivo.trim() === ''}
        data-testid="soporte-otorgar"
        onClick={() => setConfirmando(true)}
      >
        Otorgar acceso de soporte
      </Button>
      <DialogoConfirmacion
        abierto={confirmando}
        titulo={`¿Otorgar acceso de soporte a ${operadorEmail}?`}
        etiquetaConfirmar="Otorgar acceso"
        testid="soporte-otorgar-confirmacion"
        onConfirmar={() => {
          setConfirmando(false);
          startTransition(async () => {
            const r = await otorgar(operadorId, Number(horas), motivo.trim());
            if (r.ok) {
              toast.success('Acceso otorgado (queda en tu bitácora)');
              setError(null);
              router.push('.');
              router.refresh();
            } else {
              setError(r.error ?? 'No se pudo otorgar el acceso');
              toast.error(r.error ?? 'No se pudo otorgar el acceso');
            }
          });
        }}
        onCerrar={() => setConfirmando(false)}
      >
        El acceso es de solo lectura, exclusivo para esta persona, expira automáticamente y puedes
        revocarlo en cualquier momento con un clic. Cada consulta que haga quedará en tu bitácora.
      </DialogoConfirmacion>
      {error && (
        <p role="alert" className="text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}

export function RevocarAcceso({
  grantId,
  operadorEmail,
  revocar,
}: {
  grantId: string;
  operadorEmail: string;
  revocar: (grantId: string) => Promise<ResultadoSoporte>;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pendiente}
      data-testid={`revocar-${grantId}`}
      onClick={() =>
        startTransition(async () => {
          const r = await revocar(grantId);
          if (r.ok) {
            toast.success(`Acceso de ${operadorEmail} revocado`);
            router.refresh();
          } else {
            toast.error(r.error ?? 'No se pudo revocar');
          }
        })
      }
    >
      Revocar
    </Button>
  );
}
