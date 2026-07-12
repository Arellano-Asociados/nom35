import { accionAgregarConsultor, accionDesignarmeRD } from '@/acciones/panel';
import { AgregarConsultor, DesignarmeRD } from '@/components/panel/formulario-equipo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function PaginaEquipo({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await params;
  const acceso = await autorizarEmpresa(empresa);

  const supabase = clienteAdmin();
  const [{ data: roles }, { data: consultores }] = await Promise.all([
    supabase
      .from('role_assignments')
      .select('auth_user_id, role, is_designated_responsible')
      .eq('company_id', empresa),
    supabase.from('consultant_assignments').select('consultant_user_id').eq('company_id', empresa),
  ]);

  const designar = accionDesignarmeRD.bind(null, empresa);
  const agregar = accionAgregarConsultor.bind(null, empresa);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Roles en la empresa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-slate-700">
          <p className="tabular-nums">
            Administradores: {(roles ?? []).filter((r) => r.role === 'admin_org').length} ·
            Responsables Designados:{' '}
            <span data-testid="conteo-rd">
              {(roles ?? []).filter((r) => r.is_designated_responsible).length}
            </span>{' '}
            · Consultores: {(consultores ?? []).length}
          </p>
          <p className="text-xs text-slate-500">
            El Responsable Designado es el único que puede consultar resultados individuales (cada
            consulta queda auditada) y dar seguimiento a las canalizaciones GR-I.
          </p>
          {acceso.membresia.esResponsableDesignado ? (
            <p className="font-medium text-emerald-800" data-testid="soy-rd">
              Eres Responsable Designado de esta empresa.
            </p>
          ) : acceso.membresia.rol === 'admin_org' ? (
            <DesignarmeRD designar={designar} />
          ) : null}
        </CardContent>
      </Card>

      {acceso.membresia.rol === 'admin_org' && (
        <Card>
          <CardHeader>
            <CardTitle>Consultores</CardTitle>
          </CardHeader>
          <CardContent>
            <AgregarConsultor agregar={agregar} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
