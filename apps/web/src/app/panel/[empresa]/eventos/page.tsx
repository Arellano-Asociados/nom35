import Link from 'next/link';
import { accionRegistrarEvento } from '@/acciones/eventos';
import { AvisoRolSinGestion } from '@/components/panel/aviso-rol';
import { ErrorFormulario } from '@/components/panel/error-formulario';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { CampoSelect, CampoTexto } from '@/components/ui/input';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { fechaEsMx } from '@/lib/fechas';
import { clienteSesion } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';

export default async function PaginaEventos({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorFormulario } = await searchParams;
  const { empresa } = await params;
  const acceso = await autorizarEmpresa(empresa);
  // El RD entra en solo lectura: atiende la canalización clínica que deriva del evento.
  const gestiona = puedeGestionar(acceso.membresia);
  if (!gestiona && !acceso.membresia.esResponsableDesignado) return <AvisoRolSinGestion />;

  const supabase = await clienteSesion();
  const [{ data: eventos }, { data: centros }] = await Promise.all([
    supabase
      .from('traumatic_events')
      .select('id, occurred_on, description, work_centers (name)')
      .eq('company_id', empresa)
      .order('occurred_on', { ascending: false }),
    supabase.from('work_centers').select('id, name').eq('company_id', empresa).order('name'),
  ]);

  const registrar = accionRegistrarEvento.bind(null, empresa);
  const sinCentros = (centros ?? []).length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Acontecimientos traumáticos severos</CardTitle>
          </CardHeader>
          <CardContent>
            {(eventos ?? []).length === 0 && (
              <EmptyState
                titulo="No hay acontecimientos registrados"
                descripcion="Un acontecimiento traumático severo (asalto, accidente grave, fallecimiento, violencia) obliga a aplicar la Guía de Referencia I a quienes lo presenciaron o lo sufrieron, sin esperar al ciclo de evaluación (NOM-035, numerales 5.3, 5.5 y 6.5)."
              />
            )}
            <ul className="flex flex-col gap-2" data-testid="lista-eventos">
              {(eventos ?? []).map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/panel/${empresa}/eventos/${e.id}`}
                    className="block rounded-md border border-borde px-4 py-3 text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-texto">{fechaEsMx(e.occurred_on)}</span>{' '}
                    <span className="text-texto-secundario">
                      · {(e.work_centers as unknown as { name: string }).name}
                    </span>
                    <span className="mt-1 block text-texto-secundario">{e.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {gestiona && (
          <Card>
            <CardHeader>
              <CardTitle>Registrar un acontecimiento</CardTitle>
            </CardHeader>
            <CardContent>
              {sinCentros ? (
                <EmptyState
                  titulo="Primero crea un centro de trabajo"
                  descripcion="El acontecimiento se registra en el centro donde ocurrió."
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
                <form action={registrar} className="flex flex-col gap-3 text-sm">
                  <ErrorFormulario codigo={errorFormulario} />
                  <CampoSelect etiqueta="Centro de trabajo" nombre="centro" required>
                    {(centros ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </CampoSelect>
                  <CampoTexto
                    etiqueta="Fecha del acontecimiento"
                    nombre="fecha"
                    type="date"
                    required
                  />
                  <CampoTexto
                    etiqueta="Descripción del hecho"
                    nombre="descripcion"
                    required
                    ayuda="Describe el HECHO (p. ej. “asalto a mano armada en el turno nocturno”). No escribas datos de salud ni el estado de ninguna persona: eso es información sensible y se recaba con la Guía I."
                  />
                  <p className="text-xs text-texto-terciario">
                    El registro es evidencia: no se puede editar ni borrar. Una corrección se hace
                    registrando un acontecimiento nuevo.
                  </p>
                  <Button type="submit">Registrar acontecimiento</Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
