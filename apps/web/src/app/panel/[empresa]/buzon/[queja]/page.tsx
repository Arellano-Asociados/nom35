import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CambiarEstadoQueja } from '@/components/panel/queja-detalle';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { registrarAuditoriaEstricta } from '@/lib/auditoria';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { CATEGORIAS_QUEJA, ESTADOS_QUEJA } from '@/lib/buzon';
import { fechaEsMx } from '@/lib/fechas';
// Uso justificado de service_role (CLAUDE.md §2): complaints no tiene GRANT para
// authenticated. El contenido de una queja tiene el estándar de los resultados
// individuales: cada lectura genera queja_consultada FAIL-CLOSED (sin evento no hay
// consulta). Página exceptuada en eslint.config.mjs.
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function PaginaQuejaDetalle({
  params,
}: {
  params: Promise<{ empresa: string; queja: string }>;
}) {
  const { empresa, queja } = await params;
  const acceso = await autorizarEmpresa(empresa);
  const puedeVer = puedeGestionar(acceso.membresia) || acceso.membresia.esResponsableDesignado;

  if (!puedeVer) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-700">
          El buzón solo es visible para quienes gestionan la organización o para el Responsable
          Designado.
        </CardContent>
      </Card>
    );
  }

  const supabase = clienteAdmin();
  const { data: fila } = await supabase
    .from('complaints')
    .select(
      'id, folio, category, body, is_identified, contact_name, contact_info, status, created_at',
    )
    .eq('company_id', empresa)
    .eq('id', queja)
    .maybeSingle();
  if (!fila) notFound();

  // Sin evento no hay consulta (regla 5 extendida al contenido de las quejas).
  const auditoriaRegistrada = await registrarAuditoriaEstricta(
    empresa,
    acceso.userId,
    'queja_consultada',
    'complaints',
    fila.id,
    { folio: fila.folio },
  );
  if (!auditoriaRegistrada) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-700" data-testid="error-auditoria">
          No fue posible registrar la consulta en la bitácora de auditoría; por protección de la
          confidencialidad del buzón, la queja no puede mostrarse. Intenta de nuevo.
        </CardContent>
      </Card>
    );
  }

  const { data: eventos } = await supabase
    .from('complaint_events')
    .select('from_status, to_status, note, created_at')
    .eq('complaint_id', fila.id)
    .order('created_at', { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        elementos={[
          { etiqueta: 'Buzón', href: `/panel/${empresa}/buzon` },
          { etiqueta: fila.folio },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-texto">Queja {fila.folio}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {ESTADOS_QUEJA[fila.status as keyof typeof ESTADOS_QUEJA] ?? fila.status}
        </span>
      </div>
      <p className="text-sm text-texto-secundario">
        Esta consulta quedó registrada en la bitácora de auditoría (confidencialidad 8.1 b).
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Contenido del reporte</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-slate-800">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Tipo</dt>
              <dd>
                {CATEGORIAS_QUEJA[fila.category as keyof typeof CATEGORIAS_QUEJA] ?? fila.category}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Recibida</dt>
              <dd>{fechaEsMx(fila.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Identidad</dt>
              <dd>
                {fila.is_identified
                  ? `${fila.contact_name ?? 'Sin nombre'}${fila.contact_info ? ` · ${fila.contact_info}` : ''}`
                  : 'Anónima (decisión del trabajador)'}
              </dd>
            </div>
          </dl>
          {/* Texto libre del trabajador: SIEMPRE como texto plano (JSX escapa). */}
          <p
            data-testid="cuerpo-queja"
            className="rounded-lg bg-slate-50 p-4 leading-relaxed whitespace-pre-wrap"
          >
            {fila.body}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seguimiento (procedimiento 8.2 g)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CambiarEstadoQueja companyId={empresa} quejaId={fila.id} estadoActual={fila.status} />
          {(eventos ?? []).length > 0 && (
            <ol className="flex flex-col gap-2 text-sm text-slate-700" data-testid="bitacora-queja">
              {(eventos ?? []).map((e, i) => (
                <li key={i} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">
                    {fechaEsMx(e.created_at)} ·{' '}
                    {ESTADOS_QUEJA[e.from_status as keyof typeof ESTADOS_QUEJA] ?? e.from_status} →{' '}
                    {ESTADOS_QUEJA[e.to_status as keyof typeof ESTADOS_QUEJA] ?? e.to_status}
                  </p>
                  <p className="whitespace-pre-wrap">{e.note}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Link href={`/panel/${empresa}/buzon`} className="text-sm text-marca-700 underline">
        Volver al buzón
      </Link>
    </div>
  );
}
