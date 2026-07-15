'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { accionAdoptarPlanEnPrograma, accionGenerarPlan } from '@/acciones/ia';
import { claseCampo } from '@/components/panel/campos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DialogoConfirmacion } from '@/components/ui/dialogo-confirmacion';
import type { BorradorVista } from '@/lib/ia/borradores';
import type { MedidaPlan } from '@/lib/ia/validar-salida';

// Borrador de plan de acción IA (Fase 6 §6/§7): lista de medidas EDITABLES que el usuario
// adopta al programa. La IA propone; el humano dispone y firma — el INSERT de las acciones
// es del usuario (accionAdoptarPlanEnPrograma). Un borrador sin adoptar es inconfundible.

interface MedidaEditable extends MedidaPlan {
  incluida: boolean;
  nivelAccion: string;
}

const NIVELES_ACCION = [
  { valor: '', etiqueta: 'Sin especificar' },
  { valor: 'primer_nivel', etiqueta: 'Primer nivel (organizacional)' },
  { valor: 'segundo_nivel', etiqueta: 'Segundo nivel (grupal)' },
  { valor: 'tercer_nivel', etiqueta: 'Tercer nivel (individual/clínico)' },
];

export function PlanIA({
  companyId,
  cycleId,
  disponible,
  nivelOrigen,
  borrador,
  medidasIniciales,
}: {
  companyId: string;
  cycleId: string;
  disponible: boolean;
  /** Nivel de riesgo más severo que exige programa: origen de las acciones adoptadas. */
  nivelOrigen: string;
  /** Último borrador de plan del ciclo (o null). */
  borrador: BorradorVista | null;
  /** Medidas parseadas del borrador NO adoptado (vacío si no hay o ya se adoptó). */
  medidasIniciales: MedidaPlan[];
}) {
  const router = useRouter();
  const [draftId, setDraftId] = useState<string | null>(
    borrador && !borrador.adoptado ? borrador.id : null,
  );
  const [medidas, setMedidas] = useState<MedidaEditable[]>(
    medidasIniciales.map((m) => ({ ...m, incluida: true, nivelAccion: '' })),
  );
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const yaAdoptado = borrador?.adoptado ?? false;

  const generar = () =>
    startTransition(async () => {
      const r = await accionGenerarPlan(companyId, cycleId);
      if (r.ok && r.medidas) {
        setDraftId(r.draftId ?? null);
        setMedidas(r.medidas.map((m) => ({ ...m, incluida: true, nivelAccion: '' })));
        toast.success('Borrador de plan generado. Revísalo y edítalo antes de adoptarlo.');
      } else {
        toast.error(r.error ?? 'No se pudo generar el borrador');
      }
    });

  const adoptar = () => {
    if (!draftId) return;
    startTransition(async () => {
      const r = await accionAdoptarPlanEnPrograma(
        companyId,
        cycleId,
        draftId,
        medidas
          .filter((m) => m.incluida)
          .map((m) => ({
            descripcion: m.descripcion,
            nivelOrigen,
            nivelAccion: m.nivelAccion || null,
          })),
      );
      if (r.ok) {
        toast.success('Plan adoptado: las acciones se agregaron al programa.');
        router.refresh();
      } else {
        toast.error(r.error ?? 'No se pudo adoptar el plan');
      }
    });
  };

  const actualizar = (i: number, campo: Partial<MedidaEditable>) =>
    setMedidas((prev) => prev.map((m, j) => (j === i ? { ...m, ...campo } : m)));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Plan de acción (asistido por IA)</CardTitle>
        {(medidas.length === 0 || yaAdoptado) && (
          <Button
            variant="secondary"
            disabled={pendiente || !disponible}
            data-testid="ia-generar-plan"
            onClick={generar}
          >
            {yaAdoptado ? 'Generar nuevo borrador' : 'Generar borrador de plan'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {!disponible && (
          <p className="text-texto-secundario">
            La generación asistida por IA no está configurada en este entorno.
          </p>
        )}

        {yaAdoptado && borrador && (
          <p className="rounded-md bg-slate-100 p-2 text-xs text-texto-secundario">
            El último plan asistido por IA ({borrador.modelo}) fue revisado y adoptado por{' '}
            <span className="font-medium">
              {borrador.adoptadoPor ?? 'un usuario de la empresa'}
            </span>
            ; sus medidas están en la lista de acciones del programa, marcadas como asistidas por
            IA.
          </p>
        )}

        {!yaAdoptado && medidas.length === 0 && disponible && (
          <p className="text-texto-secundario">
            Genera un borrador de plan a partir de los dominios en nivel medio, alto o muy alto.
            Cada medida se ancla a una acción de la Tabla 4/7 de la norma. Tú las editas y decides
            cuáles adoptar: al adoptarlas se agregan al programa como acciones tuyas.
          </p>
        )}

        {!yaAdoptado && medidas.length > 0 && (
          <div
            data-testid="ia-borrador-plan"
            className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50/60 p-4"
          >
            <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-amber-800 uppercase">
              <span aria-hidden>⚠</span> Borrador generado por IA — sin revisar
            </p>
            <p className="text-xs text-amber-900">
              Estas medidas las propuso un modelo de IA. Revísalas, edítalas y elige cuáles adoptar.
              Nada entra al programa hasta que tú lo adoptes.
            </p>
            <ul className="flex flex-col gap-3">
              {medidas.map((m, i) => (
                <li
                  key={i}
                  className="flex flex-col gap-1 rounded-md border border-borde bg-white p-3"
                >
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={m.incluida}
                      onChange={(e) => actualizar(i, { incluida: e.target.checked })}
                      className="mt-1"
                      data-testid={`ia-medida-incluir-${i}`}
                    />
                    <textarea
                      value={m.descripcion}
                      onChange={(e) => actualizar(i, { descripcion: e.target.value })}
                      rows={2}
                      className={`${claseCampo} flex-1`}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2 pl-6 text-xs">
                    <select
                      value={m.nivelAccion}
                      onChange={(e) => actualizar(i, { nivelAccion: e.target.value })}
                      className="rounded-md border border-borde px-2 py-1"
                      aria-label="Nivel de acción (8.5)"
                    >
                      {NIVELES_ACCION.map((n) => (
                        <option key={n.valor} value={n.valor}>
                          {n.etiqueta}
                        </option>
                      ))}
                    </select>
                    {m.sinAncla ? (
                      <span className="text-peligro">
                        Propuesta fuera del catálogo normativo — revísala con especial cuidado.
                      </span>
                    ) : (
                      <span className="text-texto-secundario">Basada en: {m.ancla}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div>
              <Button
                disabled={pendiente || medidas.every((m) => !m.incluida)}
                data-testid="ia-adoptar-plan"
                onClick={() => setConfirmando(true)}
              >
                Adoptar las medidas seleccionadas en el programa
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <DialogoConfirmacion
        abierto={confirmando}
        titulo="¿Adoptar estas medidas en el programa?"
        etiquetaConfirmar="Sí, adoptarlas"
        testid="ia-adoptar-plan-confirmacion"
        onConfirmar={() => {
          setConfirmando(false);
          adoptar();
        }}
        onCerrar={() => setConfirmando(false)}
      >
        Las medidas que marcaste se agregarán al programa como acciones tuyas, marcadas como
        asistidas por IA (quedará constancia en la bitácora). Podrás seguir editándolas como
        cualquier acción del programa.
      </DialogoConfirmacion>
    </Card>
  );
}
