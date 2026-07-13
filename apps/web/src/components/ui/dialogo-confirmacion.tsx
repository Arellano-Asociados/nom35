'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Confirmación para acciones irreversibles. Sustituye a window.confirm (auditoría v0):
 * confirm() no es estilizable, corta el hilo del lector de pantalla y solo admite un
 * párrafo plano, así que nunca explica bien la consecuencia ("se enviarán N correos").
 * Se usa <dialog> nativo con showModal(): foco atrapado, Escape y ::backdrop sin
 * dependencias nuevas. El foco inicial cae en "Cancelar": la opción segura.
 */
export function DialogoConfirmacion({
  abierto,
  titulo,
  etiquetaConfirmar,
  testid,
  onConfirmar,
  onCerrar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  etiquetaConfirmar: string;
  testid?: string;
  onConfirmar: () => void;
  /** Se invoca al cancelar, al pulsar Escape o al cerrarse el diálogo por cualquier vía. */
  onCerrar: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      aria-labelledby={idTitulo}
      data-testid={testid}
      className="m-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/50"
    >
      <h2 id={idTitulo} className="text-lg font-semibold tracking-tight text-slate-900">
        {titulo}
      </h2>
      <div className="mt-2 text-sm leading-relaxed text-slate-600">{children}</div>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button
          variant="outline"
          autoFocus
          onClick={onCerrar}
          data-testid={testid ? `${testid}-cancelar` : undefined}
        >
          Cancelar
        </Button>
        <Button onClick={onConfirmar} data-testid={testid ? `${testid}-confirmar` : undefined}>
          {etiquetaConfirmar}
        </Button>
      </div>
    </dialog>
  );
}
