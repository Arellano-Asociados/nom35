import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AccionesPublicado } from '@/components/cuestionarios/acciones-publicado';
import { EditorCuestionario } from '@/components/cuestionarios/editor-cuestionario';
import { AvisoRolSinGestion } from '@/components/panel/aviso-rol';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import type { DefinicionCuestionario } from '@/lib/cuestionarios';
import { fechaEsMx } from '@/lib/fechas';
import { FLAGS, flagActiva } from '@/lib/flags';
import { clienteSesion } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';

export default async function PaginaCuestionario({
  params,
}: {
  params: Promise<{ empresa: string; id: string }>;
}) {
  const { empresa, id } = await params;
  const acceso = await autorizarEmpresa(empresa);
  if (!puedeGestionar(acceso.membresia)) return <AvisoRolSinGestion />;
  if (!(await flagActiva(empresa, FLAGS.cuestionariosPersonalizados, true))) notFound();

  const supabase = await clienteSesion();
  const { data: fila } = await supabase
    .from('custom_questionnaires')
    .select('id, title, status, version, definition, sha256, published_at')
    .eq('company_id', empresa)
    .eq('id', id)
    .maybeSingle();
  if (!fila) notFound();

  const definicion = fila.definition as DefinicionCuestionario;

  // N para la confirmación de distribución: empleados activos sin asignación.
  const [{ count: activos }, { count: asignados }] = await Promise.all([
    supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', empresa)
      .eq('active', true),
    supabase
      .from('custom_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', empresa)
      .eq('questionnaire_id', id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        elementos={[
          { etiqueta: 'Cuestionarios', href: `/panel/${empresa}/cuestionarios` },
          { etiqueta: fila.title },
        ]}
      />

      {fila.status === 'borrador' ? (
        <EditorCuestionario
          companyId={empresa}
          id={fila.id}
          tituloInicial={fila.title}
          definicionInicial={definicion}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-texto">{fila.title}</h2>
            <span
              data-testid="cp-estado"
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                fila.status === 'publicado'
                  ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                  : 'border-amber-200 bg-amber-100 text-amber-800'
              }`}
            >
              {fila.status === 'publicado' ? 'Publicado' : 'Archivado'} · v{fila.version}
            </span>
          </div>
          <p className="text-xs text-texto-secundario">
            Publicado el {fechaEsMx(fila.published_at)} · huella de integridad{' '}
            <code className="font-mono" title={fila.sha256 ?? ''}>
              {(fila.sha256 ?? '').slice(0, 12)}…
            </code>{' '}
            · inmutable: los cambios requieren una nueva versión.
          </p>
          <AccionesPublicado
            companyId={empresa}
            id={fila.id}
            status={fila.status as 'publicado' | 'archivado'}
            definicion={definicion}
            empleadosSinAsignar={Math.max(0, (activos ?? 0) - (asignados ?? 0))}
          />
          <p className="text-sm">
            <Link
              href={`/panel/${empresa}/cuestionarios/${fila.id}/resultados`}
              className="font-medium text-marca-700 underline hover:text-marca-800"
            >
              Ver resultados ({asignados ?? 0} asignados)
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
