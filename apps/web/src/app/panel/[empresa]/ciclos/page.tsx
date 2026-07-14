import Link from 'next/link';
import { accionCrearCiclo } from '@/acciones/panel';
import { ErrorFormulario } from '@/components/panel/error-formulario';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { CampoSelect, CampoTexto } from '@/components/ui/input';
import { AvisoRolSinGestion } from '@/components/panel/aviso-rol';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { fechaEsMx } from '@/lib/fechas';
import { clienteSesion } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';

export default async function PaginaCiclos({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorFormulario } = await searchParams;
  const { empresa } = await params;
  const acceso = await autorizarEmpresa(empresa);
  // El RD (rol miembro + flag) SÍ entra: navega a canalizaciones/resultados desde el
  // ciclo. Solo lectura: el formulario de creación se oculta más abajo.
  const gestiona = puedeGestionar(acceso.membresia);
  if (!gestiona && !acceso.membresia.esResponsableDesignado) return <AvisoRolSinGestion />;

  const supabase = await clienteSesion();
  const [{ data: ciclos }, { data: centros }, { data: alertas }] = await Promise.all([
    supabase
      .from('compliance_cycles')
      .select('id, name, date_start, date_end, evaluator_name, work_centers (name)')
      .eq('company_id', empresa)
      .order('date_start', { ascending: false }),
    supabase.from('work_centers').select('id, name').eq('company_id', empresa).order('name'),
    supabase
      .from('work_centers_alerta_ciclo')
      .select('work_center_id, name, requiere_nueva_evaluacion')
      .eq('company_id', empresa),
  ]);

  const crear = accionCrearCiclo.bind(null, empresa);
  const vencidos = (alertas ?? []).filter((a) => a.requiere_nueva_evaluacion);
  const sinCentros = (centros ?? []).length === 0;

  return (
    <div className="flex flex-col gap-4">
      {vencidos.length > 0 && (
        <p
          role="status"
          data-testid="alerta-24-meses"
          className="rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-900"
        >
          {vencidos.map((v) => v.name).join(', ')}: más de 24 meses sin evaluación. La NOM-035 exige
          una nueva evaluación (numeral 7.9).
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ciclos de evaluación</CardTitle>
          </CardHeader>
          <CardContent>
            {(ciclos ?? []).length === 0 && (
              <EmptyState
                titulo="Aún no hay ciclos de evaluación"
                descripcion="El ciclo agrupa la aplicación de cuestionarios de un centro y toda su evidencia: resultados, informe y expediente de inspección. Crea el primero con el formulario."
              />
            )}
            <ul className="flex flex-col gap-2" data-testid="lista-ciclos">
              {(ciclos ?? []).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/panel/${empresa}/ciclos/${c.id}`}
                    className="block rounded-md border border-borde px-4 py-3 text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-texto">{c.name}</span>{' '}
                    <span className="text-texto-secundario">
                      · {(c.work_centers as unknown as { name: string }).name} · inicia{' '}
                      {fechaEsMx(c.date_start)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {gestiona && (
          <Card>
            <CardHeader>
              <CardTitle>Nuevo ciclo</CardTitle>
            </CardHeader>
            <CardContent>
              {sinCentros ? (
                <EmptyState
                  titulo="Primero crea un centro de trabajo"
                  descripcion="Cada ciclo evalúa un centro; sin centros no hay qué evaluar."
                  cta={
                    <Link
                      href={`/panel/${empresa}/centros`}
                      className="text-sm font-medium text-marca-700 underline hover:text-marca-800"
                    >
                      Ir a Centros
                    </Link>
                  }
                />
              ) : (
                <form action={crear} className="flex flex-col gap-3 text-sm">
                  <ErrorFormulario codigo={errorFormulario} />
                  <CampoTexto etiqueta="Nombre del ciclo" nombre="nombre" required />
                  <CampoSelect etiqueta="Centro de trabajo" nombre="centro" required>
                    {(centros ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </CampoSelect>
                  <div className="grid grid-cols-2 gap-3">
                    <CampoTexto etiqueta="Fecha de inicio" nombre="inicio" type="date" required />
                    <CampoTexto etiqueta="Fecha de fin" nombre="fin" type="date" />
                  </div>
                  <CampoTexto etiqueta="Nombre del evaluador" nombre="evaluador" required />
                  <CampoTexto
                    etiqueta="Cédula profesional del evaluador"
                    nombre="cedula"
                    required
                  />
                  <p className="text-xs text-texto-terciario">
                    Los cuestionarios a aplicar se seleccionan automáticamente según el tamaño del
                    centro.
                  </p>
                  <Button type="submit">Crear ciclo</Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
