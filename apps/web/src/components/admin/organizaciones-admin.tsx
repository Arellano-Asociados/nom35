'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPlataforma } from '@/acciones/plataforma';
import { claseCampo } from '@/components/panel/campos';
import { Button } from '@/components/ui/button';
import { DialogoConfirmacion } from '@/components/ui/dialogo-confirmacion';

export function CrearOrganizacion({
  crear,
}: {
  crear: (razonSocial: string, rfc: string, emailAdmin: string) => Promise<ResultadoPlataforma>;
}) {
  const router = useRouter();
  const [razon, setRazon] = useState('');
  const [rfc, setRfc] = useState('');
  const [email, setEmail] = useState('');
  const [resultado, setResultado] = useState<ResultadoPlataforma | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1 font-medium text-slate-800">
        Razón social
        <input
          value={razon}
          onChange={(e) => setRazon(e.target.value)}
          data-testid="org-razon"
          className={claseCampo}
        />
      </label>
      <label className="flex flex-col gap-1 font-medium text-slate-800">
        RFC (opcional)
        <input
          value={rfc}
          onChange={(e) => setRfc(e.target.value)}
          data-testid="org-rfc"
          className={claseCampo}
        />
      </label>
      <label className="flex flex-col gap-1 font-medium text-slate-800">
        Correo del primer administrador
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="org-email-admin"
          className={claseCampo}
        />
      </label>
      <Button
        disabled={pendiente || razon.trim() === '' || email.trim() === ''}
        data-testid="crear-organizacion"
        onClick={() =>
          startTransition(async () => {
            const r = await crear(razon.trim(), rfc.trim(), email.trim());
            setResultado(r);
            if (r.ok) {
              toast.success('Organización creada e invitación enviada');
              setRazon('');
              setRfc('');
              setEmail('');
              router.refresh();
            } else {
              toast.error(r.error ?? 'No se pudo crear la organización');
            }
          })
        }
      >
        Crear e invitar administrador
      </Button>
      {resultado?.error && (
        <p role="alert" className="text-peligro">
          {resultado.error}
        </p>
      )}
    </div>
  );
}

/** Suspensión / baja: acciones con motivo y confirmación explícita. */
export function TransicionConMotivo({
  etiqueta,
  etiquetaMotivo,
  descripcion,
  testid,
  ejecutar,
}: {
  etiqueta: string;
  etiquetaMotivo: string;
  descripcion: string;
  testid: string;
  ejecutar: (motivo: string) => Promise<ResultadoPlataforma>;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1 font-medium text-slate-800">
        {etiquetaMotivo}
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          data-testid={`${testid}-motivo`}
          className={claseCampo}
        />
      </label>
      <Button
        variant="outline"
        disabled={pendiente || motivo.trim() === ''}
        data-testid={testid}
        onClick={() => setConfirmando(true)}
      >
        {etiqueta}
      </Button>
      <DialogoConfirmacion
        abierto={confirmando}
        titulo={`¿${etiqueta}?`}
        etiquetaConfirmar={etiqueta}
        testid={`${testid}-confirmacion`}
        onConfirmar={() => {
          setConfirmando(false);
          startTransition(async () => {
            const r = await ejecutar(motivo.trim());
            if (r.ok) {
              toast.success('Transición aplicada');
              setMotivo('');
              setError(null);
              router.refresh();
            } else {
              setError(r.error ?? 'No se pudo aplicar la transición');
              toast.error(r.error ?? 'No se pudo aplicar la transición');
            }
          });
        }}
        onCerrar={() => setConfirmando(false)}
      >
        {descripcion}
      </DialogoConfirmacion>
      {error && (
        <p role="alert" className="text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}

/** Reactivación (o reversión de baja): sin motivo, con confirmación. */
export function TransicionSimple({
  etiqueta,
  descripcion,
  testid,
  ejecutar,
}: {
  etiqueta: string;
  descripcion: string;
  testid: string;
  ejecutar: () => Promise<ResultadoPlataforma>;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 text-sm">
      <Button
        variant="secondary"
        disabled={pendiente}
        data-testid={testid}
        onClick={() => setConfirmando(true)}
      >
        {etiqueta}
      </Button>
      <DialogoConfirmacion
        abierto={confirmando}
        titulo={`¿${etiqueta}?`}
        etiquetaConfirmar={etiqueta}
        testid={`${testid}-confirmacion`}
        onConfirmar={() => {
          setConfirmando(false);
          startTransition(async () => {
            const r = await ejecutar();
            if (r.ok) {
              toast.success('Transición aplicada');
              setError(null);
              router.refresh();
            } else {
              setError(r.error ?? 'No se pudo aplicar la transición');
              toast.error(r.error ?? 'No se pudo aplicar la transición');
            }
          });
        }}
        onCerrar={() => setConfirmando(false)}
      >
        {descripcion}
      </DialogoConfirmacion>
      {error && (
        <p role="alert" className="text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
