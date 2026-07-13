'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { ResultadoPanel } from '@/acciones/panel';
import { Button } from '@/components/ui/button';
import { DialogoConfirmacion } from '@/components/ui/dialogo-confirmacion';

/** Botón genérico para acciones de servidor del panel que devuelven ResultadoPanel. */
export function BotonAccion({
  etiqueta,
  accion,
  variante = 'default',
  testid,
  confirmacion,
}: {
  etiqueta: string;
  accion: () => Promise<ResultadoPanel>;
  variante?: 'default' | 'secondary' | 'outline';
  testid?: string;
  /**
   * Confirmación para acciones IRREVERSIBLES (auditoría v0): distribuir y recordar
   * mandan correos reales a toda la plantilla con un solo clic, y los recordatorios
   * además ROTAN el token, invalidando los enlaces que los empleados ya tenían. La
   * descripción debe decir la consecuencia concreta (p. ej. "Se enviarán N correos").
   */
  confirmacion?: {
    titulo: string;
    descripcion: ReactNode;
    etiquetaConfirmar: string;
  };
}) {
  const router = useRouter();
  const [resultado, setResultado] = useState<ResultadoPanel | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const ejecutar = () =>
    startTransition(async () => {
      const r = await accion();
      setResultado(r);
      if (r.ok) {
        toast.success(r.detalle?.[0] ?? `Listo: ${etiqueta}`);
        router.refresh();
      } else {
        toast.error(r.error ?? `No se pudo completar: ${etiqueta}`);
      }
    });

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={variante}
        disabled={pendiente}
        data-testid={testid}
        onClick={() => (confirmacion ? setConfirmando(true) : ejecutar())}
      >
        {pendiente ? 'Procesando…' : etiqueta}
      </Button>
      {confirmacion && (
        <DialogoConfirmacion
          abierto={confirmando}
          titulo={confirmacion.titulo}
          etiquetaConfirmar={confirmacion.etiquetaConfirmar}
          testid={testid ? `${testid}-confirmacion` : undefined}
          onConfirmar={() => {
            setConfirmando(false);
            ejecutar();
          }}
          onCerrar={() => setConfirmando(false)}
        >
          {confirmacion.descripcion}
        </DialogoConfirmacion>
      )}
      {resultado?.error && (
        <p role="alert" className="text-sm text-peligro">
          {resultado.error}
        </p>
      )}
      {resultado?.detalle && (
        <ul
          className="text-sm text-slate-600"
          data-testid={testid ? `${testid}-detalle` : undefined}
        >
          {resultado.detalle.map((linea, i) => (
            <li key={i}>{linea}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
