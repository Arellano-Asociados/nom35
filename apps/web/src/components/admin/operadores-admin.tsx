'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPlataforma } from '@/acciones/plataforma';
import { claseCampo } from '@/components/panel/campos';
import { Button } from '@/components/ui/button';
import { DialogoConfirmacion } from '@/components/ui/dialogo-confirmacion';

export function InvitarOperador({
  invitar,
}: {
  invitar: (email: string) => Promise<ResultadoPlataforma>;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [resultado, setResultado] = useState<ResultadoPlataforma | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1 font-medium text-slate-800">
        Correo del nuevo operador
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="email-operador"
          className={claseCampo}
        />
      </label>
      <Button
        disabled={pendiente || email.trim() === ''}
        data-testid="invitar-operador"
        onClick={() =>
          startTransition(async () => {
            const r = await invitar(email.trim());
            setResultado(r);
            if (r.ok) {
              toast.success('Invitación enviada');
              setEmail('');
              router.refresh();
            } else {
              toast.error(r.error ?? 'No se pudo invitar al operador');
            }
          })
        }
      >
        Invitar operador
      </Button>
      {resultado?.error && (
        <p role="alert" className="text-peligro">
          {resultado.error}
        </p>
      )}
    </div>
  );
}

export function DeshabilitarOperador({
  operadorId,
  email,
  deshabilitar,
}: {
  operadorId: string;
  email: string;
  deshabilitar: (operadorId: string) => Promise<ResultadoPlataforma>;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="outline"
        disabled={pendiente}
        data-testid={`deshabilitar-${email}`}
        onClick={() => setConfirmando(true)}
      >
        Deshabilitar
      </Button>
      <DialogoConfirmacion
        abierto={confirmando}
        titulo={`¿Deshabilitar a ${email}?`}
        etiquetaConfirmar="Deshabilitar"
        testid="deshabilitar-confirmacion"
        onConfirmar={() => {
          setConfirmando(false);
          startTransition(async () => {
            const r = await deshabilitar(operadorId);
            if (r.ok) {
              toast.success('Operador deshabilitado');
              router.refresh();
            } else {
              toast.error(r.error ?? 'No se pudo deshabilitar');
            }
          });
        }}
        onCerrar={() => setConfirmando(false)}
      >
        La cuenta pierde el acceso al portal de inmediato y no puede reactivarse (si la persona
        vuelve, se le invita de nuevo). La baja queda en la bitácora de plataforma.
      </DialogoConfirmacion>
    </>
  );
}
