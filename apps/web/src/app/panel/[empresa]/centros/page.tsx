import { accionCrearCentro } from '@/acciones/panel';
import { claseCampo, claseEstadoVacio } from '@/components/panel/campos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const ETIQUETA_CATEGORIA: Record<string, string> = {
  solo_gr1: 'Solo GR-I (≤15 trabajadores)',
  gr1_gr2: 'GR-I + GR-II (16–50)',
  gr1_gr3: 'GR-I + GR-III (>50)',
};

export default async function PaginaCentros({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await params;
  await autorizarEmpresa(empresa);

  const { data: centros } = await clienteAdmin()
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
            <p className={claseEstadoVacio}>
              Aún no hay centros de trabajo. Crea el primero con el formulario.
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="lista-centros">
              {(centros ?? []).map((c) => (
                <li key={c.id} className="rounded-md border border-slate-200 px-4 py-3 text-sm">
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-slate-600">
                    <span className="tabular-nums">{c.headcount}</span> trabajadores ·{' '}
                    {ETIQUETA_CATEGORIA[c.nom_category] ?? c.nom_category}
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
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Nombre
              <input name="nombre" required className={claseCampo} />
            </label>
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Número de trabajadores
              <input name="headcount" type="number" min={1} required className={claseCampo} />
            </label>
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Domicilio
              <input name="direccion" className={claseCampo} />
            </label>
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Actividad principal
              <input name="actividad" className={claseCampo} />
            </label>
            <p className="text-xs text-slate-500">
              La categoría normativa (guías a aplicar) se deriva automáticamente del número de
              trabajadores: ≤15 solo GR-I · 16–50 GR-I+GR-II · &gt;50 GR-I+GR-III.
            </p>
            <Button type="submit">Crear centro</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
