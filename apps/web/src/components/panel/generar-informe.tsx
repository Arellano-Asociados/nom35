'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoGenerarInforme, ResultadoUrlDescarga } from '@/acciones/informes';
import { Button } from '@/components/ui/button';

export interface InformeFila {
  id: string;
  reportType: 'informe_79' | 'expediente_zip' | 'export_excel';
  createdAt: string;
  sha256: string;
}

const ETIQUETA_TIPO: Record<InformeFila['reportType'], string> = {
  informe_79: 'Informe 7.9',
  expediente_zip: 'Expediente de inspección',
  export_excel: 'Exportación Excel',
};

/**
 * Botones de generación (informe 7.9 / expediente) + historial descargable del ciclo.
 * Un único componente cliente: la tabla necesita un botón interactivo por fila (descarga
 * vía signed URL), así que vive junto a los botones de generación en lugar de dividirse
 * entre server/client. Las acciones de servidor llegan ya ligadas a companyId/cycleId
 * (`.bind(null, empresa, ciclo)`), salvo la de descarga que llega ligada solo a companyId
 * y recibe el reporteId de cada fila al invocarse.
 */
export function GenerarInforme({
  informes,
  generarInforme79,
  generarExpediente,
  obtenerUrlDescarga,
}: {
  informes: InformeFila[];
  generarInforme79: () => Promise<ResultadoGenerarInforme>;
  generarExpediente: () => Promise<ResultadoGenerarInforme>;
  obtenerUrlDescarga: (reporteId: string) => Promise<ResultadoUrlDescarga>;
}) {
  const router = useRouter();

  const [pendiente79, iniciar79] = useTransition();
  const [pendienteExpediente, iniciarExpediente] = useTransition();

  const [error79, setError79] = useState<string | null>(null);
  const [errorExpediente, setErrorExpediente] = useState<string | null>(null);

  // Estado de descarga POR FILA: cada informe.id se rastrea de forma independiente
  // (Set para "en curso", Map para el error y para el enlace de respaldo) en lugar de un
  // único valor compartido, para que la descarga de una fila nunca pise el estado de otra
  // cuando dos descargas están en vuelo al mismo tiempo.
  const [descargando, setDescargando] = useState<Set<string>>(new Set());
  const [erroresDescarga, setErroresDescarga] = useState<Map<string, string>>(new Map());
  const [urlsRespaldo, setUrlsRespaldo] = useState<Map<string, string>>(new Map());

  function generar(
    accion: () => Promise<ResultadoGenerarInforme>,
    iniciar: typeof iniciar79,
    setError: typeof setError79,
    mensajeExito: string,
  ) {
    iniciar(async () => {
      setError(null);
      const r = await accion();
      if (r.ok) {
        toast.success(mensajeExito);
        router.refresh();
      } else {
        setError(r.error);
        toast.error(r.error);
      }
    });
  }

  async function descargar(reporteId: string) {
    setDescargando((prev) => new Set(prev).add(reporteId));
    setErroresDescarga((prev) => {
      const siguiente = new Map(prev);
      siguiente.delete(reporteId);
      return siguiente;
    });
    setUrlsRespaldo((prev) => {
      const siguiente = new Map(prev);
      siguiente.delete(reporteId);
      return siguiente;
    });

    try {
      const r = await obtenerUrlDescarga(reporteId);
      if (r.ok) {
        // window.open ocurre después de un await (fuera de la pila síncrona del click), así
        // que algunos navegadores pueden bloquearlo como ventana emergente. Si eso pasa,
        // window.open devuelve null/undefined en lugar de lanzar: hay que revisarlo o el
        // usuario se queda sin descarga y sin ningún aviso.
        const ventana = window.open(r.url, '_blank');
        if (!ventana) {
          setErroresDescarga((prev) =>
            new Map(prev).set(
              reporteId,
              'El navegador bloqueó la ventana de descarga. Habilita las ventanas emergentes para este sitio, o usa este enlace:',
            ),
          );
          setUrlsRespaldo((prev) => new Map(prev).set(reporteId, r.url));
          toast.error('El navegador bloqueó la ventana emergente de descarga.', {
            description: 'Habilita las ventanas emergentes o usa el enlace de respaldo.',
          });
        }
      } else {
        setErroresDescarga((prev) => new Map(prev).set(reporteId, r.error));
        toast.error(r.error);
      }
    } finally {
      setDescargando((prev) => {
        const siguiente = new Set(prev);
        siguiente.delete(reporteId);
        return siguiente;
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-2">
          <Button
            disabled={pendiente79}
            aria-busy={pendiente79}
            data-testid="generar-informe-79"
            onClick={() => generar(generarInforme79, iniciar79, setError79, 'Informe 7.9 generado')}
          >
            {pendiente79 ? 'Generando…' : 'Generar informe 7.9'}
          </Button>
          {error79 && (
            <p role="alert" className="text-sm text-peligro">
              {error79}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            disabled={pendienteExpediente}
            aria-busy={pendienteExpediente}
            data-testid="generar-expediente"
            onClick={() =>
              generar(
                generarExpediente,
                iniciarExpediente,
                setErrorExpediente,
                'Expediente de inspección generado',
              )
            }
          >
            {pendienteExpediente ? 'Generando…' : 'Generar expediente de inspección'}
          </Button>
          {errorExpediente && (
            <p role="alert" className="text-sm text-peligro">
              {errorExpediente}
            </p>
          )}
        </div>
      </div>

      {informes.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
          Aún no se ha generado ningún informe. Genera el primero con los botones de arriba.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="historial-informes">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                <th className="py-2 font-medium">Tipo</th>
                <th className="py-2 font-medium">Fecha</th>
                <th
                  className="py-2 font-medium"
                  title="Código que permite demostrar que el archivo no fue alterado (SHA-256)"
                >
                  Huella de integridad
                </th>
                <th className="py-2 font-medium">Descarga</th>
              </tr>
            </thead>
            <tbody>
              {informes.map((informe) => {
                const enCurso = descargando.has(informe.id);
                const errorFila = erroresDescarga.get(informe.id);
                const urlRespaldo = urlsRespaldo.get(informe.id);
                const fechaFormateada = new Date(informe.createdAt).toLocaleString('es-MX');
                return (
                  <tr
                    key={informe.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                    data-testid="fila-informe"
                    data-report-id={informe.id}
                    data-report-type={informe.reportType}
                  >
                    <td className="py-2 font-medium text-slate-900">
                      {ETIQUETA_TIPO[informe.reportType]}
                    </td>
                    <td className="py-2 text-slate-700 tabular-nums">{fechaFormateada}</td>
                    <td className="py-2 text-slate-700 tabular-nums">
                      <span title={informe.sha256}>{informe.sha256.slice(0, 12)}…</span>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-col items-start gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={enCurso}
                          aria-busy={enCurso}
                          aria-label={`Descargar ${ETIQUETA_TIPO[informe.reportType]} del ${fechaFormateada}`}
                          data-testid="descargar-informe"
                          onClick={() => descargar(informe.id)}
                        >
                          {enCurso ? 'Preparando…' : 'Descargar'}
                        </Button>
                        {errorFila && (
                          <p role="alert" className="text-sm text-peligro">
                            {errorFila}
                          </p>
                        )}
                        {urlRespaldo && (
                          <a
                            href={urlRespaldo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-marca-700 underline"
                          >
                            Descargar manualmente
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
