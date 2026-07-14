'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPanel } from '@/acciones/panel';
import { claseCampo } from '@/components/panel/campos';
import { Button } from '@/components/ui/button';
import { DialogoConfirmacion } from '@/components/ui/dialogo-confirmacion';

export function DesignarmeRD({
  designar,
}: {
  designar: (cedula: string) => Promise<ResultadoPanel>;
}) {
  const router = useRouter();
  const [cedula, setCedula] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPanel | null>(null);
  const [pendiente, startTransition] = useTransition();

  const ejecutar = () =>
    startTransition(async () => {
      const r = await designar(cedula.trim());
      setResultado(r);
      if (r.ok) {
        toast.success('Designación registrada como Responsable Designado');
        router.refresh();
      } else {
        toast.error(r.error ?? 'No se pudo completar la designación');
      }
    });

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1 font-medium text-slate-800">
        Cédula profesional (evidencia del responsable)
        <input value={cedula} onChange={(e) => setCedula(e.target.value)} className={claseCampo} />
      </label>
      <Button
        disabled={pendiente || cedula.trim() === ''}
        data-testid="designarme-rd"
        onClick={() => setConfirmando(true)}
      >
        Asumir el rol de Responsable Designado
      </Button>
      {/* Confirmación explícita (mini-fase 3): el flag de RD es la única barrera entre
          un rol patronal y los resultados individuales de salud. La consecuencia se
          dice completa, la bitácora la registra y los demás admins reciben aviso. */}
      <DialogoConfirmacion
        abierto={confirmando}
        titulo="¿Asumir el rol de Responsable Designado?"
        etiquetaConfirmar="Asumir el rol y notificar"
        testid="designarme-rd-confirmacion"
        onConfirmar={() => {
          setConfirmando(false);
          ejecutar();
        }}
        onCerrar={() => setConfirmando(false)}
      >
        Este rol permite consultar resultados individuales de salud. Cada consulta queda registrada
        en la bitácora de auditoría, la designación misma deja constancia con tu usuario y cédula, y
        los demás administradores de la organización recibirán un aviso por correo.
      </DialogoConfirmacion>
      {resultado?.error && (
        <p role="alert" className="text-peligro">
          {resultado.error}
        </p>
      )}
    </div>
  );
}

export function AgregarConsultor({
  agregar,
}: {
  agregar: (email: string) => Promise<ResultadoPanel>;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [resultado, setResultado] = useState<ResultadoPanel | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1 font-medium text-slate-800">
        Correo del consultor (con cuenta ya confirmada)
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="email-consultor"
          className={claseCampo}
        />
      </label>
      <Button
        variant="secondary"
        disabled={pendiente || email.trim() === ''}
        data-testid="agregar-consultor"
        onClick={() =>
          startTransition(async () => {
            const r = await agregar(email.trim());
            setResultado(r);
            if (r.ok) {
              toast.success('Consultor asignado');
              setEmail('');
              router.refresh();
            } else {
              toast.error(r.error ?? 'No se pudo asignar al consultor');
            }
          })
        }
      >
        Asignar consultor
      </Button>
      {resultado?.error && (
        <p role="alert" className="text-peligro">
          {resultado.error}
        </p>
      )}
    </div>
  );
}
