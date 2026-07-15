import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarSoporte } from '@/lib/autorizacion-plataforma';
import { iaDraftsMetadataSoporte } from '@/lib/soporte-datos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Soporte: IA' };

const ETIQUETA_TIPO: Record<string, string> = {
  resumen_ejecutivo: 'Resumen ejecutivo',
  plan_accion: 'Plan de acción',
};

function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso));
}

export default async function PaginaSoporteIa({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  await autorizarSoporte(companyId, 'ia');
  const drafts = await iaDraftsMetadataSoporte(companyId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Borradores asistidos por IA (metadata)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-texto-secundario">
          Solo metadata: el TEXTO de los borradores y el insumo que vio la IA (que incluye la
          interpretación de resultados y los nombres de centros del cliente) no son visibles para
          soporte.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs text-texto-secundario uppercase">
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Modelo</th>
              <th className="py-2 pr-3">Prompt</th>
              <th className="py-2 pr-3">Generado</th>
              <th className="py-2">Adoptado</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d, i) => (
              <tr key={i} className="border-b border-borde/60">
                <td className="py-2 pr-3">{ETIQUETA_TIPO[d.tipo] ?? d.tipo}</td>
                <td className="py-2 pr-3">{d.modelo}</td>
                <td className="py-2 pr-3">
                  <code className="font-mono text-xs">{d.promptVersion}</code>
                </td>
                <td className="py-2 pr-3 text-texto-secundario">{fechaHora(d.createdAt)}</td>
                <td className="py-2">{d.adoptadoEl ? fechaHora(d.adoptadoEl) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {drafts.length === 0 && (
          <p className="py-4 text-sm text-texto-secundario">Sin borradores de IA.</p>
        )}
      </CardContent>
    </Card>
  );
}
