'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  accionArchivarCuestionario,
  accionDistribuirCuestionario,
  accionNuevaVersion,
} from '@/acciones/cuestionarios';
import { RenderCuestionario } from '@/components/cuestionarios/render-cuestionario';
import { Button } from '@/components/ui/button';
import { DialogoConfirmacion } from '@/components/ui/dialogo-confirmacion';
import type { DefinicionCuestionario } from '@/lib/cuestionarios';

/** Acciones y vista previa de un cuestionario publicado/archivado (inmutable). */
export function AccionesPublicado({
  companyId,
  id,
  status,
  definicion,
  empleadosSinAsignar,
}: {
  companyId: string;
  id: string;
  status: 'publicado' | 'archivado';
  definicion: DefinicionCuestionario;
  empleadosSinAsignar: number;
}) {
  const router = useRouter();
  const [previa, setPrevia] = useState(false);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [confirmaDistribuir, setConfirmaDistribuir] = useState(false);
  const [ocupado, startTransition] = useTransition();

  const distribuir = () =>
    startTransition(async () => {
      const r = await accionDistribuirCuestionario(companyId, id);
      if (r.ok) {
        toast.success(r.detalle?.[0] ?? 'Cuestionario distribuido');
        router.refresh();
      } else {
        toast.error(r.error ?? 'No se pudo distribuir');
      }
    });

  const nuevaVersion = () =>
    startTransition(async () => {
      const r = await accionNuevaVersion(companyId, id);
      if (r.ok && r.id) {
        toast.success('Nueva versión creada como borrador');
        router.push(`/panel/${companyId}/cuestionarios/${r.id}`);
      } else {
        toast.error(r.error ?? 'No se pudo crear la nueva versión');
      }
    });

  const archivar = () =>
    startTransition(async () => {
      const r = await accionArchivarCuestionario(companyId, id);
      if (r.ok) {
        toast.success('Cuestionario archivado');
        router.refresh();
      } else {
        toast.error(r.error ?? 'No se pudo archivar');
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {status === 'publicado' && (
          <Button
            cargando={ocupado}
            onClick={() => setConfirmaDistribuir(true)}
            data-testid="cp-distribuir"
          >
            Distribuir a empleados
          </Button>
        )}
        <Button variant="secondary" cargando={ocupado} onClick={nuevaVersion}>
          Crear nueva versión
        </Button>
        {status === 'publicado' && (
          <Button variant="outline" cargando={ocupado} onClick={archivar}>
            Archivar
          </Button>
        )}
        <Button variant="outline" onClick={() => setPrevia((v) => !v)}>
          {previa ? 'Ocultar vista previa' : 'Vista previa'}
        </Button>
      </div>

      {previa && (
        <div className="mx-auto w-full max-w-[390px] rounded-2xl border-4 border-slate-300 bg-fondo p-3">
          <p className="mb-2 text-center text-xs text-texto-terciario">
            Vista previa · así lo ve el empleado
          </p>
          <RenderCuestionario
            definicion={definicion}
            respuestas={respuestas}
            onResponder={(pid, v) => setRespuestas((r) => ({ ...r, [pid]: v }))}
          />
        </div>
      )}

      <DialogoConfirmacion
        abierto={confirmaDistribuir}
        titulo="¿Distribuir este cuestionario?"
        etiquetaConfirmar={`Enviar ${empleadosSinAsignar} correos`}
        testid="cp-distribuir-confirmacion"
        onConfirmar={() => {
          setConfirmaDistribuir(false);
          distribuir();
        }}
        onCerrar={() => setConfirmaDistribuir(false)}
      >
        Se enviarán {empleadosSinAsignar} correos, uno por cada empleado activo que aún no tiene
        este cuestionario asignado, cada uno con su enlace personal. Los correos no se pueden
        cancelar una vez enviados.
      </DialogoConfirmacion>
    </div>
  );
}
