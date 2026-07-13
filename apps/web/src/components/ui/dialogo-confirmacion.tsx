'use client';

import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

/**
 * Confirmación para acciones irreversibles (Fase 1.5; sustituyó a window.confirm).
 * La descripción debe decir la consecuencia concreta ("se enviarán N correos").
 * Compone el Modal base; conserva su API y sus data-testid (los E2E los usan).
 * El foco inicial cae en "Cancelar": la opción segura.
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
  return (
    <Modal
      abierto={abierto}
      titulo={titulo}
      onCerrar={onCerrar}
      testid={testid}
      pie={
        <>
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
        </>
      }
    >
      {children}
    </Modal>
  );
}
