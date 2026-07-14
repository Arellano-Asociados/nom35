'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoRegistro } from '@/acciones/registros';
import { Button } from '@/components/ui/button';

// Descarga de los registros del 5.8 (datos de salud por persona). El CSV se genera bajo
// demanda en el servidor —con guardia de RD y auditoría fail-closed— y se entrega en la
// respuesta de la acción: nunca se guarda en Storage ni se envía por correo.

export function DescargarRegistro({
  etiqueta,
  ayuda,
  testid,
  generar,
}: {
  etiqueta: string;
  ayuda: string;
  testid: string;
  generar: () => Promise<ResultadoRegistro>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const descargar = () =>
    startTransition(async () => {
      setError(null);
      const r = await generar();
      if (!r.ok) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      const binario = Uint8Array.from(atob(r.contenido), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([binario], { type: 'text/csv;charset=utf-8' }));
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = r.nombre;
      enlace.click();
      URL.revokeObjectURL(url);
      toast.success('Registro descargado. La consulta quedó en la bitácora de auditoría.');
    });

  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" disabled={pendiente} data-testid={testid} onClick={descargar}>
        {pendiente ? 'Generando…' : etiqueta}
      </Button>
      <p className="text-xs text-texto-terciario">{ayuda}</p>
      {error && (
        <p role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
