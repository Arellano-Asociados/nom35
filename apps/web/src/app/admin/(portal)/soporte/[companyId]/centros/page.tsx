import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarSoporte } from '@/lib/autorizacion-plataforma';
import { centrosSoporte } from '@/lib/soporte-datos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Soporte: centros' };

const CATEGORIA: Record<string, string> = {
  solo_gr1: 'Solo GR-I (≤15)',
  gr1_gr2: 'GR-I + GR-II (16–50)',
  gr1_gr3: 'GR-I + GR-III (>50)',
};

export default async function PaginaSoporteCentros({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  await autorizarSoporte(companyId, 'centros');
  const centros = await centrosSoporte(companyId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Centros de trabajo</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs text-texto-secundario uppercase">
              <th className="py-2 pr-3">Centro</th>
              <th className="py-2 pr-3">Plantilla</th>
              <th className="py-2">Categoría normativa</th>
            </tr>
          </thead>
          <tbody>
            {centros.map((c) => (
              <tr key={c.id} className="border-b border-borde/60">
                <td className="py-2 pr-3">{c.nombre}</td>
                <td className="py-2 pr-3 tabular-nums">{c.headcount}</td>
                <td className="py-2">{CATEGORIA[c.categoria] ?? c.categoria}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {centros.length === 0 && (
          <p className="py-4 text-sm text-texto-secundario">Sin centros registrados.</p>
        )}
      </CardContent>
    </Card>
  );
}
