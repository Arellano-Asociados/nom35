import { accionCrearCentro } from '@/acciones/panel';
import { ErrorFormulario } from '@/components/panel/error-formulario';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { CampoTexto } from '@/components/ui/input';
import { AvisoRolSinGestion } from '@/components/panel/aviso-rol';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { clienteSesion } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';

const ETIQUETA_CATEGORIA: Record<string, string> = {
  solo_gr1: 'Solo GR-I (≤15 trabajadores)',
  gr1_gr2: 'GR-I + GR-II (16–50)',
  gr1_gr3: 'GR-I + GR-III (>50)',
};

export default async function PaginaCentros({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorFormulario } = await searchParams;
  const { empresa } = await params;
  const acceso = await autorizarEmpresa(empresa);
  if (!puedeGestionar(acceso.membresia)) return <AvisoRolSinGestion />;

  const supabase = await clienteSesion();
  const { data: centros } = await supabase
    .from('work_centers')
    .select('id, name, headcount, nom_category, address')
    .eq('company_id', empresa)
    .order('created_at');

  const crear = accionCrearCentro.bind(null, empresa);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Centros de trabajo</CardTitle>
        </CardHeader>
        <CardContent>
          {(centros ?? []).length === 0 ? (
            <EmptyState
              titulo="Aún no hay centros de trabajo"
              descripcion="El centro de trabajo es la unidad que evalúa la norma: su número de trabajadores decide qué cuestionarios aplican. Crea el primero con el formulario de al lado."
            />
          ) : (
            <ul className="flex flex-col gap-2" data-testid="lista-centros">
              {(centros ?? []).map((c) => (
                <li key={c.id} className="rounded-md border border-borde px-4 py-3 text-sm">
                  <p className="font-medium text-texto">{c.name}</p>
                  <p className="text-texto-secundario">
                    <span className="tabular-nums">{c.headcount}</span> trabajadores ·{' '}
                    {ETIQUETA_CATEGORIA[c.nom_category] ?? 'Categoría no determinada'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo centro</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={crear} className="flex flex-col gap-3 text-sm">
            <ErrorFormulario codigo={errorFormulario} />
            <CampoTexto etiqueta="Nombre" nombre="nombre" required />
            <CampoTexto
              etiqueta="Número de trabajadores"
              nombre="headcount"
              type="number"
              min={1}
              required
            />
            <CampoTexto etiqueta="Domicilio" nombre="direccion" />
            <CampoTexto etiqueta="Actividad principal" nombre="actividad" />
            <p className="text-xs text-texto-terciario">
              Los cuestionarios a aplicar se eligen solos según el tamaño del centro: hasta 15
              trabajadores, solo la Guía I; de 16 a 50, Guías I y II; más de 50, Guías I y III.
            </p>
            <Button type="submit">Crear centro</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
