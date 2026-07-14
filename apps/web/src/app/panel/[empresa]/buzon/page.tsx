import Link from 'next/link';
import { BotonAccion } from '@/components/panel/boton-accion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { accionCrearORotarEnlaceBuzon } from '@/acciones/buzon';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { CATEGORIAS_QUEJA, ESTADOS_QUEJA } from '@/lib/buzon';
import { fechaEsMx } from '@/lib/fechas';
// Uso justificado de service_role (CLAUDE.md §2): complaints no tiene GRANT para
// authenticated (estándar de dato sensible). Esta lista muestra SOLO metadatos
// (folio, categoría, estado, fecha); el contenido exige la página de detalle, que
// audita cada lectura fail-closed. Página exceptuada en eslint.config.mjs.
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function PaginaBuzonPanel({
  params,
}: {
  params: Promise<{ empresa: string }>;
}) {
  const { empresa } = await params;
  const acceso = await autorizarEmpresa(empresa);
  const esGestion = puedeGestionar(acceso.membresia);
  const puedeVer = esGestion || acceso.membresia.esResponsableDesignado;

  if (!puedeVer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Buzón de quejas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-700">
          El buzón solo es visible para quienes gestionan la organización o para el Responsable
          Designado.{' '}
          <Link href={`/panel/${empresa}/equipo`} className="text-marca-700 underline">
            Ver el equipo
          </Link>
          .
        </CardContent>
      </Card>
    );
  }

  const supabase = clienteAdmin();
  const [{ data: buzon }, { data: quejas }] = await Promise.all([
    supabase
      .from('complaint_boxes')
      .select('token, rotated_at')
      .eq('company_id', empresa)
      .maybeSingle(),
    supabase
      .from('complaints')
      .select('id, folio, category, status, is_identified, created_at')
      .eq('company_id', empresa)
      .order('created_at', { ascending: false }),
  ]);

  const base = process.env.NEXT_PUBLIC_APP_URL;
  const urlBuzon = buzon && base ? `${base}/buzon/${buzon.token}` : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-texto">
          Buzón de quejas y denuncias
        </h2>
        <p className="text-sm text-texto-secundario">
          Mecanismo seguro y confidencial que exige la NOM-035 (numeral 8.1) para recibir quejas por
          prácticas opuestas al entorno organizacional favorable y denuncias de violencia laboral.
          Cada lectura del contenido de una queja queda en la bitácora.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enlace del buzón</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-slate-700">
          {urlBuzon ? (
            <>
              <p>
                Difunde este enlace a toda tu plantilla (la norma exige informar el mecanismo,
                numeral 5.7): correo interno, carteles con código QR o intranet. No identifica a
                nadie: las quejas pueden ser anónimas.
              </p>
              <p
                data-testid="url-buzon"
                className="rounded-lg bg-slate-50 p-3 font-mono text-xs break-all"
              >
                {urlBuzon}
              </p>
              {buzon && (
                <p className="text-xs text-slate-500">
                  Enlace vigente desde {fechaEsMx(buzon.rotated_at)}.
                </p>
              )}
            </>
          ) : (
            <p>
              Tu organización aún no tiene enlace del buzón. Al crearlo podrás difundirlo a tu
              plantilla; las quejas llegarán aquí.
            </p>
          )}
          {esGestion && (
            <BotonAccion
              etiqueta={urlBuzon ? 'Rotar enlace del buzón' : 'Crear enlace del buzón'}
              variante={urlBuzon ? 'outline' : 'default'}
              testid="crear-enlace-buzon"
              accion={accionCrearORotarEnlaceBuzon.bind(null, empresa)}
              confirmacion={
                urlBuzon
                  ? {
                      titulo: 'Rotar el enlace del buzón',
                      descripcion: (
                        <p>
                          El enlace actual dejará de funcionar de inmediato: los carteles o correos
                          donde lo hayas difundido quedarán obsoletos y tendrás que difundir el
                          nuevo.
                        </p>
                      ),
                      etiquetaConfirmar: 'Rotar enlace',
                    }
                  : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      {(quejas ?? []).length === 0 ? (
        <EmptyState
          titulo="Sin quejas recibidas"
          descripcion="Cuando un trabajador presente una queja o denuncia aparecerá aquí. Solo verás el contenido al abrirla, y cada lectura queda registrada."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Quejas recibidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="lista-quejas">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Folio
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Tipo
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Estado
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Identidad
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Recibida
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(quejas ?? []).map((q) => (
                    <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 pr-4 font-mono font-medium">
                        <Link
                          href={`/panel/${empresa}/buzon/${q.id}`}
                          className="text-marca-700 underline"
                        >
                          {q.folio}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-slate-700">
                        {CATEGORIAS_QUEJA[q.category as keyof typeof CATEGORIAS_QUEJA] ??
                          q.category}
                      </td>
                      <td className="py-2 pr-4 text-slate-700">
                        {ESTADOS_QUEJA[q.status as keyof typeof ESTADOS_QUEJA] ?? q.status}
                      </td>
                      <td className="py-2 pr-4 text-slate-700">
                        {q.is_identified ? 'Identificada' : 'Anónima'}
                      </td>
                      <td className="py-2 text-slate-700">{fechaEsMx(q.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
