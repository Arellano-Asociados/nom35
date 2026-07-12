'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPanel } from '@/acciones/panel';
import { Button } from '@/components/ui/button';

export function DesignarmeRD({
  designar,
}: {
  designar: (cedula: string) => Promise<ResultadoPanel>;
}) {
  const router = useRouter();
  const [cedula, setCedula] = useState('');
  const [resultado, setResultado] = useState<ResultadoPanel | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1 font-medium text-slate-800">
        Cédula profesional (evidencia del responsable)
        <input
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <Button
        disabled={pendiente || cedula.trim() === ''}
        data-testid="designarme-rd"
        onClick={() =>
          startTransition(async () => {
            const r = await designar(cedula.trim());
            setResultado(r);
            if (r.ok) {
              toast.success('Designación registrada como Responsable Designado');
              router.refresh();
            } else {
              toast.error(r.error ?? 'No se pudo completar la designación');
            }
          })
        }
      >
        Designarme Responsable Designado
      </Button>
      {resultado?.error && (
        <p role="alert" className="text-red-700">
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
        Correo del consultor (debe tener cuenta)
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="email-consultor"
          className="rounded-md border border-slate-300 px-3 py-2"
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
        <p role="alert" className="text-red-700">
          {resultado.error}
        </p>
      )}
    </div>
  );
}
