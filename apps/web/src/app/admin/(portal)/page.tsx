import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarPlataforma } from '@/lib/autorizacion-plataforma';
import { ETIQUETA_ESTADO } from '@/lib/estados-empresa';
import { metricasPlataforma } from '@/lib/metricas-plataforma';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Operación de plataforma' };

// Dashboard operativo (spec §5): SOLO métricas operativas (estados, conteos, tasa de
// participación agregada — conducta, no salud). La frontera de columnas vive en las
// vistas de la migración: aquí no hay forma de pedir lo prohibido.

function Indicador({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl border border-borde bg-white p-4">
      <p className="text-2xl font-semibold text-texto tabular-nums">{valor}</p>
      <p className="text-xs text-texto-secundario">{etiqueta}</p>
    </div>
  );
}

export default async function PaginaPortalAdmin() {
  const operador = await autorizarPlataforma();
  const m = await metricasPlataforma();

  const tasa =
    m.participacion.asignaciones > 0
      ? Math.round((m.participacion.completadas / m.participacion.asignaciones) * 100)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-texto">Operación de plataforma</h1>
        <p className="text-sm text-texto-secundario">
          Sesión de {operador.email}. Todas tus acciones quedan en la bitácora de plataforma.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador etiqueta="Organizaciones activas" valor={String(m.porEstado['active'] ?? 0)} />
        <Indicador
          etiqueta="Suspendidas / en baja"
          valor={`${m.porEstado['suspended'] ?? 0} / ${m.porEstado['pending_deletion'] ?? 0}`}
        />
        <Indicador etiqueta="Empleados activos (todas)" valor={String(m.totalEmpleados)} />
        <Indicador etiqueta="Tasa de respuesta global" valor={tasa === null ? '—' : `${tasa}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Organizaciones{' '}
              <span className="text-sm font-normal text-texto-secundario">
                ({m.organizaciones.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs text-texto-secundario uppercase">
                  <th className="py-2 pr-3">Razón social</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Centros</th>
                  <th className="py-2">Empleados</th>
                </tr>
              </thead>
              <tbody>
                {m.organizaciones.map((o) => {
                  const estado = ETIQUETA_ESTADO[o.status] ?? { texto: o.status, clase: '' };
                  return (
                    <tr key={o.id} className="border-b border-borde/60">
                      <td className="py-2 pr-3">
                        <Link
                          href={`/admin/organizaciones/${o.id}`}
                          className="text-marca-700 underline"
                        >
                          {o.legalName}
                        </Link>
                      </td>
                      <td className={`py-2 pr-3 ${estado.clase}`}>{estado.texto}</td>
                      <td className="py-2 pr-3 tabular-nums">{o.centros}</td>
                      <td className="py-2 tabular-nums">{o.empleados}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {m.organizaciones.length === 0 && (
              <p className="py-4 text-sm text-texto-secundario">Aún no hay organizaciones.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ciclos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-texto-secundario">
            <p className="tabular-nums">
              Totales: {m.ciclos.total} · En curso: {m.ciclos.enCurso} · Por evento ATS:{' '}
              {m.ciclos.ats}
            </p>
            <p className="tabular-nums">
              Participación agregada: {m.participacion.completadas} de{' '}
              {m.participacion.asignaciones} cuestionarios completados
              {tasa !== null && ` (${tasa}%)`}.
            </p>
            <p className="text-xs">
              La tasa de respuesta es conducta operativa (participación), no un dato de salud, y
              solo se muestra agregada — nunca por centro pequeño. Ningún indicador de este
              dashboard deriva de resultados.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
