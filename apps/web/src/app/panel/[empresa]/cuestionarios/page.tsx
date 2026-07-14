import Link from 'next/link';
import { notFound } from 'next/navigation';
import { accionCrearCuestionario } from '@/acciones/cuestionarios';
import { AvisoRolSinGestion } from '@/components/panel/aviso-rol';
import { ErrorFormulario } from '@/components/panel/error-formulario';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { CampoTexto } from '@/components/ui/input';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { fechaEsMx } from '@/lib/fechas';
import { FLAGS, flagActiva } from '@/lib/flags';
import { clienteSesion } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  archivado: 'Archivado',
};

const CLASE_ESTADO: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-700 border-slate-200',
  publicado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  archivado: 'bg-amber-100 text-amber-800 border-amber-200',
};

export default async function PaginaCuestionarios({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { empresa } = await params;
  const { error: errorFormulario } = await searchParams;
  const acceso = await autorizarEmpresa(empresa);
  if (!puedeGestionar(acceso.membresia)) return <AvisoRolSinGestion />;
  // Feature flag (Fase 3): la plataforma puede apagar la capacidad por organización.
  if (!(await flagActiva(empresa, FLAGS.cuestionariosPersonalizados, true))) notFound();

  const supabase = await clienteSesion();
  const { data: cuestionarios } = await supabase
    .from('custom_questionnaires')
    .select('id, title, status, version, created_at, published_at')
    .eq('company_id', empresa)
    .order('created_at', { ascending: false });

  const crear = accionCrearCuestionario.bind(null, empresa);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Cuestionarios personalizados</CardTitle>
          <p className="text-xs text-texto-secundario">
            Adicionales a las guías oficiales de la NOM-035, que son intocables. No generan semáforo
            ni entran al informe normativo: tienen su propio reporte.
          </p>
        </CardHeader>
        <CardContent>
          {(cuestionarios ?? []).length === 0 ? (
            <EmptyState
              titulo="Aún no hay cuestionarios personalizados"
              descripcion="Crea encuestas propias (clima, seguimiento, pulso) con secciones, varios tipos de pregunta y lógica condicional. Se publican selladas y se distribuyen por enlace personal, como las guías."
            />
          ) : (
            <ul className="flex flex-col gap-2" data-testid="lista-cuestionarios">
              {(cuestionarios ?? []).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/panel/${empresa}/cuestionarios/${c.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-borde px-4 py-3 text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-texto">
                      {c.title}{' '}
                      <span className="font-normal text-texto-secundario">· v{c.version}</span>
                    </span>
                    <span className="flex items-center gap-2 text-texto-secundario">
                      {fechaEsMx(c.published_at ?? c.created_at)}
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CLASE_ESTADO[c.status] ?? ''}`}
                      >
                        {ETIQUETA_ESTADO[c.status] ?? c.status}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo cuestionario</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={crear} className="flex flex-col gap-3 text-sm">
            <ErrorFormulario codigo={errorFormulario} />
            <CampoTexto etiqueta="Título" nombre="titulo" required />
            <p className="text-xs text-texto-terciario">
              Se crea como borrador: podrás armar secciones y preguntas en el editor, verlo como lo
              verá el empleado y publicarlo cuando esté listo.
            </p>
            <Button type="submit">Crear y abrir el editor</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
