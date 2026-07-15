import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  accionReactivarEmpresa,
  accionRevertirBaja,
  accionSolicitarBaja,
  accionSuspenderEmpresa,
} from '@/acciones/plataforma';
import { TransicionConMotivo, TransicionSimple } from '@/components/admin/organizaciones-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarPlataforma } from '@/lib/autorizacion-plataforma';
import { ETIQUETA_ESTADO } from '@/lib/estados-empresa';
import { fechaEsMx } from '@/lib/fechas';
import { RETENCION_DIAS } from '@/lib/organizaciones';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ficha de organización' };

export default async function PaginaFichaOrganizacion({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await autorizarPlataforma();
  const { companyId } = await params;

  // service_role justificado: superficie exclusiva del portal (ficha cross-tenant de
  // METADATOS de la organización — nada derivado de salud, regla 4 aplicada al operador).
  const admin = clienteAdmin();
  const { data: empresa } = await admin
    .from('companies')
    .select(
      'id, legal_name, rfc, status, created_at, status_changed_at, suspension_reason, deletion_requested_at',
    )
    .eq('id', companyId)
    .maybeSingle();
  if (!empresa) notFound();

  const [{ count: centros }, { count: empleados }] = await Promise.all([
    admin
      .from('work_centers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId),
    admin
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('active', true),
  ]);

  const estado = ETIQUETA_ESTADO[empresa.status] ?? {
    texto: empresa.status,
    clase: 'text-texto-secundario',
  };

  const suspender = accionSuspenderEmpresa.bind(null, companyId);
  const reactivar = accionReactivarEmpresa.bind(null, companyId);
  const solicitarBaja = accionSolicitarBaja.bind(null, companyId);
  const revertirBaja = accionRevertirBaja.bind(null, companyId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-texto" data-testid="ficha-razon-social">
          {empresa.legal_name}
        </h1>
        <p className="text-sm text-texto-secundario">
          Estado: <span className={`font-medium ${estado.clase}`}>{estado.texto}</span>
          {empresa.status_changed_at && <> · desde {fechaEsMx(empresa.status_changed_at)}</>}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-texto-secundario">
            <p>RFC: {empresa.rfc ?? '—'}</p>
            <p>Alta: {fechaEsMx(empresa.created_at)}</p>
            <p className="tabular-nums">
              Centros de trabajo: {centros ?? 0} · Empleados activos: {empleados ?? 0}
            </p>
            {empresa.status === 'suspended' && empresa.suspension_reason && (
              <p>Motivo de suspensión: {empresa.suspension_reason}</p>
            )}
            {empresa.status === 'pending_deletion' && empresa.deletion_requested_at && (
              <p className="text-peligro">
                Baja solicitada el {fechaEsMx(empresa.deletion_requested_at)}: la purga manual es
                admisible {RETENCION_DIAS} días después, con los 4 avisos de retención enviados.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transiciones de estado</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {empresa.status === 'active' && (
              <TransicionConMotivo
                etiqueta="Suspender organización"
                etiquetaMotivo="Motivo de la suspensión"
                descripcion="El panel del cliente queda en solo lectura (con descarga de su evidencia); sus empleados no pueden responder y no se envía ningún correo. Queda en ambas bitácoras."
                testid="suspender-empresa"
                ejecutar={suspender}
              />
            )}
            {empresa.status === 'suspended' && (
              <TransicionSimple
                etiqueta="Reactivar organización"
                descripcion="La operación del cliente se restablece por completo."
                testid="reactivar-empresa"
                ejecutar={reactivar}
              />
            )}
            {empresa.status === 'pending_deletion' ? (
              <TransicionSimple
                etiqueta="Revertir baja (a suspendida)"
                descripcion="Detiene el reloj de purga: la organización vuelve a 'suspendida'. Reactivarla es una decisión separada."
                testid="revertir-baja"
                ejecutar={revertirBaja}
              />
            ) : (
              <TransicionConMotivo
                etiqueta="Solicitar baja"
                etiquetaMotivo="Motivo de la baja"
                descripcion={`Inicia la retención de ${RETENCION_DIAS} días en solo lectura, con avisos automáticos al cliente (días 1, 30, 60 y 85) para que descargue su expediente final. La purga física es un acto manual posterior y separado.`}
                testid="solicitar-baja"
                ejecutar={solicitarBaja}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
