'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { accionGuardarPlantilla, accionRestaurarPlantilla } from '@/acciones/configuracion';
import { Button } from '@/components/ui/button';
import { claseControl } from '@/components/ui/input';
import {
  PLANTILLAS_DEFAULT,
  renderPlantilla,
  TIPOS_PLANTILLA,
  type Plantilla,
  type TipoPlantilla,
} from '@/lib/plantillas';
import { cn } from '@/lib/utils';

const ETIQUETA_TIPO: Record<TipoPlantilla, string> = {
  invitacion: 'Invitación',
  recordatorio: 'Recordatorio',
  acuse: 'Acuse de recibo',
};

const MUESTRA = {
  nombre: 'Ana López',
  empresa: 'Tu empresa, S.A. de C.V.',
  fecha_limite: '15 de agosto de 2026',
};

/**
 * Editor de plantillas de correo (Fase 3): variables {{nombre}}, {{empresa}} y
 * {{fecha_limite}}; vista previa con datos de muestra usando el MISMO render del
 * envío real; "restaurar" borra la fila y vuelve la plantilla original. El HTML
 * siempre se escapa al enviar: la plantilla es texto plano.
 */
export function EditorPlantillas({
  companyId,
  guardadas,
}: {
  companyId: string;
  guardadas: Partial<Record<TipoPlantilla, Plantilla>>;
}) {
  const [tipo, setTipo] = useState<TipoPlantilla>('invitacion');
  const [borradores, setBorradores] = useState<Record<TipoPlantilla, Plantilla>>({
    invitacion: guardadas.invitacion ?? PLANTILLAS_DEFAULT.invitacion,
    recordatorio: guardadas.recordatorio ?? PLANTILLAS_DEFAULT.recordatorio,
    acuse: guardadas.acuse ?? PLANTILLAS_DEFAULT.acuse,
  });
  const [ocupado, startTransition] = useTransition();

  const actual = borradores[tipo];
  const previa = renderPlantilla(actual, MUESTRA);

  const mutar = (cambio: Partial<Plantilla>) =>
    setBorradores((b) => ({ ...b, [tipo]: { ...b[tipo], ...cambio } }));

  const guardar = () =>
    startTransition(async () => {
      const r = await accionGuardarPlantilla(companyId, tipo, actual.asunto, actual.cuerpo);
      if (r.ok) toast.success('Plantilla guardada');
      else toast.error(r.error ?? 'No se pudo guardar');
    });

  const restaurar = () =>
    startTransition(async () => {
      const r = await accionRestaurarPlantilla(companyId, tipo);
      if (r.ok) {
        setBorradores((b) => ({ ...b, [tipo]: PLANTILLAS_DEFAULT[tipo] }));
        toast.success('Plantilla original restaurada');
      } else {
        toast.error(r.error ?? 'No se pudo restaurar');
      }
    });

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div
        role="tablist"
        aria-label="Tipo de plantilla"
        className="flex gap-1 border-b border-borde"
      >
        {TIPOS_PLANTILLA.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tipo === t}
            onClick={() => setTipo(t)}
            className={cn(
              'border-b-2 px-3 py-2 font-medium transition-colors',
              tipo === t
                ? 'border-marca-700 text-marca-700'
                : 'border-transparent text-texto-secundario hover:text-texto',
            )}
          >
            {ETIQUETA_TIPO[t]}
          </button>
        ))}
      </div>

      <p className="text-xs text-texto-secundario">
        Variables disponibles: <code>{'{{nombre}}'}</code>, <code>{'{{empresa}}'}</code>,{' '}
        <code>{'{{fecha_limite}}'}</code>. El enlace del botón lo pone el sistema y no es editable;
        el texto se envía siempre sin HTML.
      </p>

      <label className="flex flex-col gap-1 font-medium text-slate-800">
        Asunto
        <input
          value={actual.asunto}
          onChange={(e) => mutar({ asunto: e.target.value })}
          className={claseControl}
        />
      </label>
      <label className="flex flex-col gap-1 font-medium text-slate-800">
        Cuerpo (párrafos separados por una línea en blanco)
        <textarea
          rows={8}
          value={actual.cuerpo}
          onChange={(e) => mutar({ cuerpo: e.target.value })}
          className={claseControl}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <Button cargando={ocupado} onClick={guardar} data-testid="plantilla-guardar">
          Guardar plantilla
        </Button>
        <Button variant="outline" cargando={ocupado} onClick={restaurar}>
          Restaurar plantilla original
        </Button>
      </div>

      <div className="rounded-lg border border-borde bg-slate-50 p-4">
        <p className="mb-2 text-xs font-medium tracking-wide text-texto-terciario uppercase">
          Vista previa (con datos de muestra)
        </p>
        <p className="font-semibold text-texto">{previa.asunto}</p>
        <div className="mt-2 flex flex-col gap-2 text-slate-700">
          {previa.parrafos.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p className="mt-1 w-fit rounded-md bg-marca-700 px-4 py-2 text-sm font-semibold text-white">
            {tipo === 'acuse' ? '(sin botón)' : 'Responder cuestionario'}
          </p>
        </div>
      </div>
    </div>
  );
}
