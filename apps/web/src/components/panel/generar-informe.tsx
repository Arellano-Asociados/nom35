'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
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
  const [pendienteDescargaId, setPendienteDescargaId] = useState<string | null>(null);
  const [descargaEnCurso, iniciarDescarga] = useTransition();

  const [error79, setError79] = useState<string | null>(null);
  const [errorExpediente, setErrorExpediente] = useState<string | null>(null);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);

  function generar(
    accion: () => Promise<ResultadoGenerarInforme>,
    iniciar: typeof iniciar79,
    setError: typeof setError79,
  ) {
    iniciar(async () => {
      setError(null);
      const r = await accion();
      if (r.ok) {
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function descargar(reporteId: string) {
    setPendienteDescargaId(reporteId);
    iniciarDescarga(async () => {
      setErrorDescarga(null);
      const r = await obtenerUrlDescarga(reporteId);
      if (r.ok) {
        window.open(r.url, '_blank');
      } else {
        setErrorDescarga(r.error);
      }
      setPendienteDescargaId(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-2">
          <Button
            disabled={pendiente79}
            aria-busy={pendiente79}
            data-testid="generar-informe-79"
            onClick={() => generar(generarInforme79, iniciar79, setError79)}
          >
            {pendiente79 ? 'Generando…' : 'Generar informe 7.9'}
          </Button>
          {error79 && (
            <p role="alert" className="text-sm text-red-700">
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
            onClick={() => generar(generarExpediente, iniciarExpediente, setErrorExpediente)}
          >
            {pendienteExpediente ? 'Generando…' : 'Generar expediente de inspección'}
          </Button>
          {errorExpediente && (
            <p role="alert" className="text-sm text-red-700">
              {errorExpediente}
            </p>
          )}
        </div>
      </div>

      {errorDescarga && (
        <p role="alert" className="text-sm text-red-700">
          {errorDescarga}
        </p>
      )}

      {informes.length === 0 ? (
        <p className="text-sm text-slate-600">Aún no se ha generado ningún informe.</p>
      ) : (
        <table className="w-full text-sm" data-testid="historial-informes">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2">Tipo</th>
              <th className="py-2">Fecha</th>
              <th className="py-2">SHA-256</th>
              <th className="py-2">Descarga</th>
            </tr>
          </thead>
          <tbody>
            {informes.map((informe) => {
              const descargando = descargaEnCurso && pendienteDescargaId === informe.id;
              return (
                <tr
                  key={informe.id}
                  className="border-b border-slate-100"
                  data-testid="fila-informe"
                  data-report-id={informe.id}
                  data-report-type={informe.reportType}
                >
                  <td className="py-2 font-medium text-slate-900">
                    {ETIQUETA_TIPO[informe.reportType]}
                  </td>
                  <td className="py-2">{new Date(informe.createdAt).toLocaleString('es-MX')}</td>
                  <td className="py-2">
                    <span title={informe.sha256}>{informe.sha256.slice(0, 12)}…</span>
                  </td>
                  <td className="py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={descargando}
                      aria-busy={descargando}
                      data-testid="descargar-informe"
                      onClick={() => descargar(informe.id)}
                    >
                      {descargando ? 'Preparando…' : 'Descargar'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
