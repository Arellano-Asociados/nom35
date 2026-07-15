import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarSoporte } from '@/lib/autorizacion-plataforma';
import { difusionMetadataSoporte } from '@/lib/soporte-datos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Soporte: difusión' };

export default async function PaginaSoporteDifusion({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  await autorizarSoporte(companyId, 'difusion');
  const constancias = await difusionMetadataSoporte(companyId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Constancias de difusión (metadata)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-texto-secundario">
          Solo metadata y conteo de acuses: el CONTENIDO del resumen difundido deriva de resultados
          y no es visible para soporte.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs text-texto-secundario uppercase">
              <th className="py-2 pr-3">Versión</th>
              <th className="py-2 pr-3">Huella (SHA-256)</th>
              <th className="py-2">Acuses</th>
            </tr>
          </thead>
          <tbody>
            {constancias.map((d) => (
              <tr key={d.id} className="border-b border-borde/60">
                <td className="py-2 pr-3 tabular-nums">v{d.version}</td>
                <td className="py-2 pr-3">
                  <code className="font-mono text-xs break-all">{d.sha256}</code>
                </td>
                <td className="py-2 tabular-nums">{d.acuses}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {constancias.length === 0 && (
          <p className="py-4 text-sm text-texto-secundario">Sin constancias publicadas.</p>
        )}
      </CardContent>
    </Card>
  );
}
