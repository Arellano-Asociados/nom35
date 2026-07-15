import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarSoporte } from '@/lib/autorizacion-plataforma';
import { fechaEsMx } from '@/lib/fechas';
import { programaMetadataSoporte } from '@/lib/soporte-datos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Soporte: programa' };

export default async function PaginaSoportePrograma({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  await autorizarSoporte(companyId, 'programa');
  const programas = await programaMetadataSoporte(companyId);

  return (
    <div className="flex flex-col gap-4">
      {programas.length === 0 && (
        <Card>
          <CardContent className="py-4 text-sm text-texto-secundario">
            Sin programas de intervención registrados.
          </CardContent>
        </Card>
      )}
      {programas.map((p) => (
        <Card key={p.id}>
          <CardHeader>
            <CardTitle>Programa de intervención (metadata)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              Alcance: {p.alcance} · Responsable: {p.responsable}
            </p>
            <p className="text-xs text-texto-secundario">
              Acciones sin evidencias adjuntas (los archivos de evidencia no son visibles para
              soporte).
            </p>
            <ul className="flex flex-col gap-1">
              {p.acciones.map((a, i) => (
                <li key={i} className="text-texto-secundario">
                  {a.descripcion} — nivel {a.nivelOrigen} — {a.estatus}
                  {a.fecha ? ` — compromiso ${fechaEsMx(a.fecha)}` : ''}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
