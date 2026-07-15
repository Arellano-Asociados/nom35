import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarSoporte } from '@/lib/autorizacion-plataforma';
import { ETIQUETA_ESTADO } from '@/lib/estados-empresa';
import { fechaEsMx } from '@/lib/fechas';
import { fichaEmpresaSoporte } from '@/lib/soporte-datos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Soporte: ficha' };

export default async function PaginaSoporteFicha({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  await autorizarSoporte(companyId, 'ficha');

  const ficha = await fichaEmpresaSoporte(companyId);
  if (!ficha) notFound();
  const estado = ETIQUETA_ESTADO[ficha.status] ?? { texto: ficha.status, clase: '' };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ficha de la organización</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-texto-secundario">
        <p className="text-base font-medium text-texto" data-testid="soporte-ficha-nombre">
          {ficha.legalName}
        </p>
        <p>RFC: {ficha.rfc ?? '—'}</p>
        <p>
          Estado: <span className={estado.clase}>{estado.texto}</span>
        </p>
        <p>Alta: {fechaEsMx(ficha.createdAt)}</p>
      </CardContent>
    </Card>
  );
}
