'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { accionAdoptarBorrador, accionGenerarResumen } from '@/acciones/ia';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DialogoConfirmacion } from '@/components/ui/dialogo-confirmacion';
import type { BorradorVista } from '@/lib/ia/borradores';

// Franja de resumen ejecutivo IA (Fase 6 §5/§7). Tres estados visualmente distintos:
// sin borrador (generar), BORRADOR sin revisar (marca inconfundible, NO exportable) y
// ADOPTADO (leyenda de trazabilidad permanente). El borrador jamás ofrece copiar/exportar.

function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso));
}

export function ResumenIA({
  companyId,
  cycleId,
  disponible,
  borrador,
}: {
  companyId: string;
  cycleId: string;
  /** false → proveedor no configurado (ProveedorNulo): botón deshabilitado con aviso. */
  disponible: boolean;
  borrador: BorradorVista | null;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const generar = () =>
    startTransition(async () => {
      const r = await accionGenerarResumen(companyId, cycleId);
      if (r.ok) {
        toast.success('Borrador generado. Revísalo antes de adoptarlo.');
        router.refresh();
      } else {
        toast.error(r.error ?? 'No se pudo generar el borrador');
      }
    });

  const adoptar = () => {
    if (!borrador) return;
    startTransition(async () => {
      const r = await accionAdoptarBorrador(companyId, borrador.id);
      if (r.ok) {
        toast.success('Borrador adoptado: ahora es tu texto revisado.');
        router.refresh();
      } else {
        toast.error(r.error ?? 'No se pudo adoptar el borrador');
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Resumen ejecutivo (asistido por IA)</CardTitle>
        {(!borrador || borrador.adoptado) && (
          <Button
            variant="secondary"
            disabled={pendiente || !disponible}
            data-testid="ia-generar-resumen"
            onClick={generar}
          >
            {borrador ? 'Generar nuevo borrador' : 'Generar borrador'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {!disponible && (
          <p className="text-texto-secundario">
            La generación asistida por IA no está configurada en este entorno.
          </p>
        )}

        {!borrador && disponible && (
          <p className="text-texto-secundario">
            Genera un borrador de resumen ejecutivo del ciclo, en lenguaje para dirección, a partir
            de los datos ya agregados (nunca respuestas ni resultados individuales). Tú lo revisas y
            decides si lo adoptas.
          </p>
        )}

        {borrador && !borrador.adoptado && (
          <div
            data-testid="ia-borrador-resumen"
            className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50/60 p-4"
          >
            <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-amber-800 uppercase">
              <span aria-hidden>⚠</span> Borrador generado por IA — sin revisar
            </p>
            {/* select-none + sin botón de copia/exportación: un borrador no se lleva a
                ningún documento hasta ser adoptado (spec decisión 7). */}
            <p className="whitespace-pre-wrap text-texto select-none">{borrador.texto}</p>
            <p className="text-xs text-amber-900">
              Este texto lo redactó un modelo de IA y NADIE lo ha revisado todavía. No es evidencia
              ni puede exportarse. Léelo con atención: si lo haces tuyo, adóptalo; si no, genera
              otro.
            </p>
            <div>
              <Button
                disabled={pendiente}
                data-testid="ia-adoptar-resumen"
                onClick={() => setConfirmando(true)}
              >
                Revisé y adopto este texto
              </Button>
            </div>
          </div>
        )}

        {borrador && borrador.adoptado && (
          <div data-testid="ia-resumen-adoptado" className="flex flex-col gap-2">
            <p className="whitespace-pre-wrap text-texto">{borrador.texto}</p>
            <p className="rounded-md bg-slate-100 p-2 text-xs text-texto-secundario">
              Borrador asistido por IA ({borrador.modelo}), revisado y adoptado por{' '}
              <span className="font-medium">
                {borrador.adoptadoPor ?? 'un usuario de la empresa'}
              </span>
              {borrador.adoptadoEl ? ` el ${fechaHora(borrador.adoptadoEl)}` : ''}.
            </p>
          </div>
        )}
      </CardContent>

      <DialogoConfirmacion
        abierto={confirmando}
        titulo="¿Adoptar este resumen?"
        etiquetaConfirmar="Sí, lo hago mío"
        testid="ia-adoptar-resumen-confirmacion"
        onConfirmar={() => {
          setConfirmando(false);
          adoptar();
        }}
        onCerrar={() => setConfirmando(false)}
      >
        Al adoptarlo declaras que revisaste el texto y lo haces tuyo: quedará marcado como revisado
        por ti, con la fecha. La adopción no puede deshacerse (si cambias de opinión, genera otro
        borrador).
      </DialogoConfirmacion>
    </Card>
  );
}
