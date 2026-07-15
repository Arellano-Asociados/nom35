import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarSoporte } from '@/lib/autorizacion-plataforma';
import { fechaEsMx } from '@/lib/fechas';
import { ciclosConteosSoporte } from '@/lib/soporte-datos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Soporte: ciclos' };

export default async function PaginaSoporteCiclos({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  await autorizarSoporte(companyId, 'ciclos');
  const ciclos = await ciclosConteosSoporte(companyId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ciclos y participación</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-texto-secundario">
          Conteos de participación únicamente: los dashboards y distribuciones de riesgo no son
          visibles para soporte, ni con supresión.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs text-texto-secundario uppercase">
              <th className="py-2 pr-3">Ciclo</th>
              <th className="py-2 pr-3">Inicio</th>
              <th className="py-2 pr-3">Fin</th>
              <th className="py-2 pr-3">ATS</th>
              <th className="py-2">Completados/Asignados</th>
            </tr>
          </thead>
          <tbody>
            {ciclos.map((c) => (
              <tr key={c.id} className="border-b border-borde/60">
                <td className="py-2 pr-3">{c.nombre}</td>
                <td className="py-2 pr-3">{fechaEsMx(c.fechaInicio)}</td>
                <td className="py-2 pr-3">{c.fechaFin ? fechaEsMx(c.fechaFin) : '—'}</td>
                <td className="py-2 pr-3">{c.esEventoAts ? 'Sí' : 'No'}</td>
                <td className="py-2 tabular-nums">
                  {c.completadas}/{c.asignaciones}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ciclos.length === 0 && (
          <p className="py-4 text-sm text-texto-secundario">Sin ciclos registrados.</p>
        )}
      </CardContent>
    </Card>
  );
}
