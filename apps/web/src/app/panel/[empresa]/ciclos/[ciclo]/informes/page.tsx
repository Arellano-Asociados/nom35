import { notFound } from 'next/navigation';
import {
  accionGenerarExpediente,
  accionGenerarInforme79,
  accionUrlDescargaInforme,
} from '@/acciones/informes';
import { GenerarInforme, type InformeFila } from '@/components/panel/generar-informe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteSesion } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';

export default async function PaginaInformes({
  params,
}: {
  params: Promise<{ empresa: string; ciclo: string }>;
}) {
  const { empresa, ciclo } = await params;
  await autorizarEmpresa(empresa);

  const supabase = await clienteSesion();
  const { data: cicloExiste } = await supabase
    .from('compliance_cycles')
    .select('id')
    .eq('company_id', empresa)
    .eq('id', ciclo)
    .maybeSingle();
  if (!cicloExiste) notFound();

  // El informe solo contiene datos agregados (nunca respuestas ni resultados individuales,
  // regla inviolable 4); la lectura de `compliance_reports` la permite RLS a gestión
  // (rls_tenant.sql:264) igual que el resto de las páginas del ciclo.
  const { data: reportes } = await supabase
    .from('compliance_reports')
    .select('id, report_type, created_at, sha256')
    .eq('company_id', empresa)
    .eq('cycle_id', ciclo)
    .order('created_at', { ascending: false });

  const informes: InformeFila[] = (reportes ?? []).map((r) => ({
    id: r.id,
    reportType: r.report_type as InformeFila['reportType'],
    createdAt: r.created_at,
    sha256: r.sha256,
  }));

  const generarInforme77 = accionGenerarInforme79.bind(null, empresa, ciclo);
  const generarExpediente = accionGenerarExpediente.bind(null, empresa, ciclo);
  const obtenerUrlDescarga = accionUrlDescargaInforme.bind(null, empresa);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informes y expediente</CardTitle>
      </CardHeader>
      <CardContent>
        <GenerarInforme
          informes={informes}
          generarInforme77={generarInforme77}
          generarExpediente={generarExpediente}
          obtenerUrlDescarga={obtenerUrlDescarga}
        />
      </CardContent>
    </Card>
  );
}
