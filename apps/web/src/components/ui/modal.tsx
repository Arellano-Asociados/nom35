'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Modal base sobre <dialog> nativo con showModal(): foco atrapado, Escape y
 * ::backdrop sin dependencias. Base compartida del DialogoConfirmacion (Fase 1.5) y
 * de cualquier modal futuro del panel.
 */
export function Modal({
  abierto,
  titulo,
  onCerrar,
  testid,
  children,
  pie,
}: {
  abierto: boolean;
  titulo: string;
  /** Se invoca al pulsar Escape o cerrarse el diálogo por cualquier vía. */
  onCerrar: () => void;
  testid?: string;
  children: ReactNode;
  /** Zona de acciones (botones), alineada a la derecha. */
  pie?: ReactNode;
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
      className="m-auto w-full max-w-md rounded-lg border border-borde bg-superficie p-6 shadow-xl backdrop:bg-slate-900/50"
    >
      <h2 id={idTitulo} className="text-lg font-semibold tracking-tight text-texto">
        {titulo}
      </h2>
      <div className="mt-2 text-sm leading-relaxed text-texto-secundario">{children}</div>
      {pie && <div className="mt-5 flex flex-wrap justify-end gap-3">{pie}</div>}
    </dialog>
  );
}
