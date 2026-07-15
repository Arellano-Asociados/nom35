import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarSoporte } from '@/lib/autorizacion-plataforma';
import { flagsSoporte } from '@/lib/soporte-datos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Soporte: flags' };

export default async function PaginaSoporteFlags({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  await autorizarSoporte(companyId, 'flags');
  const flags = await flagsSoporte(companyId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature flags</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {flags.length === 0 ? (
          <p className="text-texto-secundario">
            Sin filas de flags: aplican los defaults del código.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {flags.map((f) => (
              <li key={f.flag}>
                <code className="font-mono">{f.flag}</code>:{' '}
                {f.enabled ? 'habilitado' : 'deshabilitado'}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-texto-secundario">
          La vista de soporte es solo lectura: los flags se cambian desde la ficha de la
          organización (fuera del grant), con doble bitácora.
        </p>
      </CardContent>
    </Card>
  );
}
