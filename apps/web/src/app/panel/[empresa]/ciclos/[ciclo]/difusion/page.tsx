import { BotonAccion } from '@/components/panel/boton-accion';
import { ResumenDifusionVista } from '@/components/responder/resumen-difusion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { accionPublicarDifusion } from '@/acciones/difusion';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { armarResumenDifusion } from '@/lib/difusion';
import { armarEntradaDifusionDesdeBd } from '@/lib/difusion-datos';
import { fechaEsMx } from '@/lib/fechas';
import { clienteSesion } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';

// Difusión de resultados a los trabajadores (NOM-035 5.7 e / 7.8). La vista previa
// usa EXACTAMENTE el mismo armado y el mismo render que verá el trabajador; publicar
// congela esa instantánea (append-only, sellada con sha256) como evidencia exhibible.
// Para quien no tiene enlace vigente, la constancia puede difundirse por otros medios
// (el PEC admite folletos, boletines o carteles): esta página ES el contenido.
export default async function PaginaDifusion({
  params,
}: {
  params: Promise<{ empresa: string; ciclo: string }>;
}) {
  const { empresa, ciclo } = await params;
  const acceso = await autorizarEmpresa(empresa);
  const esGestion = puedeGestionar(acceso.membresia);

  const supabase = await clienteSesion();
  const { data: publicadas } = await supabase
    .from('dissemination_records')
    .select('id, version, sha256, published_at')
    .eq('company_id', empresa)
    .eq('cycle_id', ciclo)
    .order('version', { ascending: false });

  // Conteo de acuses por versión (evidencia de difusión efectiva).
  const acusesPorDifusion = new Map<string, number>();
  if (esGestion && (publicadas ?? []).length > 0) {
    const { data: acuses } = await supabase
      .from('dissemination_receipts')
      .select('dissemination_id')
      .eq('company_id', empresa);
    for (const a of acuses ?? []) {
      acusesPorDifusion.set(
        a.dissemination_id,
        (acusesPorDifusion.get(a.dissemination_id) ?? 0) + 1,
      );
    }
  }

  const armado = await armarEntradaDifusionDesdeBd(empresa, ciclo);
  const resumenPrevio =
    armado.ok && armado.entrada.participacion.completados > 0
      ? armarResumenDifusion(armado.entrada)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Difusión de resultados a los trabajadores</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-slate-700">
          <p>
            La NOM-035 obliga a difundir los resultados de la evaluación a los trabajadores (numeral
            5.7) y a tenerlos disponibles para su consulta (numeral 7.8). Al publicar, esta vista
            previa se congela como <strong>constancia sellada</strong>: los trabajadores con enlace
            vigente la consultan y acusan desde su misma liga del cuestionario, y la constancia
            entra al expediente de inspección.
          </p>
          {resumenPrevio && esGestion && (
            <BotonAccion
              etiqueta="Publicar constancia de difusión"
              testid="publicar-difusion"
              accion={accionPublicarDifusion.bind(null, empresa, ciclo)}
              confirmacion={{
                titulo: 'Publicar constancia de difusión',
                descripcion: (
                  <p>
                    Se congelará la vista previa de abajo como constancia sellada (no se puede
                    editar ni borrar; una corrección requiere publicar una nueva versión) y quedará
                    visible para los trabajadores con enlace vigente.
                  </p>
                ),
                etiquetaConfirmar: 'Publicar',
              }}
            />
          )}
          {!resumenPrevio && (
            <p className="text-slate-500">
              Aún no hay resultados que difundir: la vista previa aparecerá cuando haya
              cuestionarios respondidos en el ciclo.
            </p>
          )}
        </CardContent>
      </Card>

      {(publicadas ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Constancias publicadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="historial-difusion">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Versión
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Publicada
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Acuses
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Huella de integridad (SHA-256)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(publicadas ?? []).map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-900">v{p.version}</td>
                      <td className="py-2 pr-4 text-slate-700">{fechaEsMx(p.published_at)}</td>
                      <td className="py-2 pr-4 text-slate-700 tabular-nums">
                        {acusesPorDifusion.get(p.id) ?? 0}
                      </td>
                      <td className="py-2 font-mono text-xs break-all text-slate-500">
                        {p.sha256}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {resumenPrevio ? (
        <section aria-label="Vista previa de la constancia" className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-texto">
            Vista previa (lo que verá el trabajador)
          </h3>
          <ResumenDifusionVista resumen={resumenPrevio} />
        </section>
      ) : (
        (publicadas ?? []).length === 0 && (
          <EmptyState
            titulo="Sin constancia de difusión"
            descripcion="Cuando el ciclo tenga resultados podrás previsualizar y publicar la constancia que la norma exige difundir a los trabajadores."
          />
        )
      )}
    </div>
  );
}
