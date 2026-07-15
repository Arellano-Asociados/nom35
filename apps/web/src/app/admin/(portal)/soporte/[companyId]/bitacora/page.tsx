import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarSoporte } from '@/lib/autorizacion-plataforma';
import { bitacoraTenantSoporte } from '@/lib/soporte-datos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Soporte: bitácora' };

const POR_PAGINA = 25;

export default async function PaginaSoporteBitacora({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { companyId } = await params;
  await autorizarSoporte(companyId, 'bitacora');
  const { pagina: paginaParam } = await searchParams;
  const pagina = Math.max(1, Number(paginaParam) || 1);
  const { eventos, total } = await bitacoraTenantSoporte(companyId, pagina, POR_PAGINA);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bitácora del tenant (soporte de «¿qué pasó?»)</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs text-texto-secundario uppercase">
              <th className="py-2 pr-3">Fecha</th>
              <th className="py-2 pr-3">Evento</th>
              <th className="py-2">Entidad</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id} className="border-b border-borde/60">
                <td className="py-2 pr-3 whitespace-nowrap text-texto-secundario">
                  {new Intl.DateTimeFormat('es-MX', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'America/Mexico_City',
                  }).format(new Date(e.createdAt))}
                </td>
                <td className="py-2 pr-3">
                  <code className="font-mono text-xs">{e.eventType}</code>
                </td>
                <td className="py-2 text-texto-secundario">{e.entity ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {eventos.length === 0 && <p className="py-4 text-sm text-texto-secundario">Sin eventos.</p>}
        <div className="mt-4 flex items-center justify-between text-sm">
          {pagina > 1 ? (
            <Link
              href={`/admin/soporte/${companyId}/bitacora?pagina=${pagina - 1}`}
              className="text-marca-700 underline"
            >
              ← Más recientes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-texto-secundario">
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link
              href={`/admin/soporte/${companyId}/bitacora?pagina=${pagina + 1}`}
              className="text-marca-700 underline"
            >
              Más antiguos →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
