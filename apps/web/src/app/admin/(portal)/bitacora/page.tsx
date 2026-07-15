import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EVENTOS_PLATAFORMA } from '@/lib/auditoria-plataforma';
import { autorizarPlataforma } from '@/lib/autorizacion-plataforma';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bitácora de plataforma' };

const POR_PAGINA = 25;

function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso));
}

export default async function PaginaBitacoraPlataforma({
  searchParams,
}: {
  searchParams: Promise<{ operador?: string; empresa?: string; evento?: string; pagina?: string }>;
}) {
  await autorizarPlataforma();
  const filtros = await searchParams;
  const pagina = Math.max(1, Number(filtros.pagina) || 1);

  // service_role justificado: platform_audit_log no tiene GRANTs para authenticated; su
  // único lector es este portal, tras autorizarPlataforma().
  const admin = clienteAdmin();

  let consulta = admin
    .from('platform_audit_log')
    .select('id, operator_id, event_type, company_id, entity, entity_id, details, created_at', {
      count: 'exact',
    })
    .order('id', { ascending: false })
    // Paginada: nunca traer la tabla entera a memoria.
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (filtros.operador) consulta = consulta.eq('operator_id', filtros.operador);
  if (filtros.empresa) consulta = consulta.eq('company_id', filtros.empresa);
  if (filtros.evento) consulta = consulta.eq('event_type', filtros.evento);

  const [{ data: eventos, count }, { data: operadores }, { data: empresas }] = await Promise.all([
    consulta,
    admin.from('platform_users').select('id, email').order('email'),
    admin.from('companies').select('id, legal_name').order('legal_name'),
  ]);

  const emailPorOperador = new Map((operadores ?? []).map((o) => [o.id as string, o.email]));
  // company_id no tiene FK a propósito (el acta sobrevive a la purga): el nombre se
  // resuelve aquí y, si la empresa ya no existe, se muestra el id del acta.
  const nombrePorEmpresa = new Map((empresas ?? []).map((e) => [e.id as string, e.legal_name]));

  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));
  const enlaceCon = (cambios: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const estado = { ...filtros, ...cambios };
    for (const [k, v] of Object.entries(estado)) {
      if (v && k !== 'pagina') params.set(k, v);
    }
    if (estado.pagina && estado.pagina !== '1') params.set('pagina', estado.pagina);
    const qs = params.toString();
    return `/admin/bitacora${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-texto">Bitácora de plataforma</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 text-sm sm:grid-cols-4">
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Operador
              <select
                name="operador"
                defaultValue={filtros.operador ?? ''}
                className="rounded-md border border-borde px-2 py-1.5"
              >
                <option value="">Todos</option>
                {(operadores ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Organización
              <select
                name="empresa"
                defaultValue={filtros.empresa ?? ''}
                className="rounded-md border border-borde px-2 py-1.5"
              >
                <option value="">Todas</option>
                {(empresas ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.legal_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-medium text-slate-800">
              Evento
              <select
                name="evento"
                defaultValue={filtros.evento ?? ''}
                className="rounded-md border border-borde px-2 py-1.5"
              >
                <option value="">Todos</option>
                {Object.values(EVENTOS_PLATAFORMA).map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="rounded-md bg-marca-700 px-4 py-1.5 font-medium text-white hover:bg-marca-800"
              >
                Filtrar
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Eventos{' '}
            <span className="text-sm font-normal text-texto-secundario">({count ?? 0})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs text-texto-secundario uppercase">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Operador</th>
                  <th className="py-2 pr-3">Evento</th>
                  <th className="py-2 pr-3">Organización</th>
                  <th className="py-2">Detalles</th>
                </tr>
              </thead>
              <tbody>
                {(eventos ?? []).map((e) => (
                  <tr key={e.id} className="border-b border-borde/60 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-texto-secundario">
                      {fechaHora(e.created_at)}
                    </td>
                    <td className="py-2 pr-3">
                      {e.operator_id ? (emailPorOperador.get(e.operator_id) ?? '—') : 'sistema'}
                    </td>
                    <td className="py-2 pr-3">
                      <code className="font-mono text-xs">{e.event_type}</code>
                    </td>
                    <td className="py-2 pr-3">
                      {e.company_id
                        ? (nombrePorEmpresa.get(e.company_id) ?? `(purgada) ${e.company_id}`)
                        : '—'}
                    </td>
                    <td className="py-2 text-xs text-texto-secundario">
                      <code className="font-mono break-all">{JSON.stringify(e.details)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(eventos ?? []).length === 0 && (
            <p className="py-4 text-sm text-texto-secundario">Sin eventos con esos filtros.</p>
          )}
          <div className="mt-4 flex items-center justify-between text-sm">
            {pagina > 1 ? (
              <Link
                href={enlaceCon({ pagina: String(pagina - 1) })}
                className="text-marca-700 underline"
              >
                ← Más recientes
              </Link>
            ) : (
              <span />
            )}
            <span className="text-texto-secundario">
              Página {pagina} de {totalPaginas}
            </span>
            {pagina < totalPaginas ? (
              <Link
                href={enlaceCon({ pagina: String(pagina + 1) })}
                className="text-marca-700 underline"
              >
                Más antiguos →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
