import type { Metadata } from 'next';
import { accionDeshabilitarOperador, accionInvitarOperador } from '@/acciones/plataforma';
import { DeshabilitarOperador, InvitarOperador } from '@/components/admin/operadores-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarPlataforma } from '@/lib/autorizacion-plataforma';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Operadores' };

const ETIQUETA_STATUS: Record<string, string> = {
  invited: 'Invitado (pendiente)',
  active: 'Activo',
  disabled: 'Deshabilitado',
};

export default async function PaginaOperadores() {
  await autorizarPlataforma();

  // service_role justificado: platform_users solo expone la fila propia vía RLS; el
  // directorio completo de operadores es una superficie exclusiva del portal.
  const { data: operadores } = await clienteAdmin()
    .from('platform_users')
    .select('id, email, display_name, status, created_at, activated_at, disabled_at')
    .order('created_at', { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-texto">Operadores de plataforma</h1>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Equipo de operación</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs text-texto-secundario uppercase">
                  <th className="py-2 pr-3">Correo</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(operadores ?? []).map((op) => (
                  <tr key={op.id} className="border-b border-borde/60">
                    <td className="py-2 pr-3">{op.email}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          op.status === 'active'
                            ? 'font-medium text-emerald-700'
                            : op.status === 'disabled'
                              ? 'text-texto-secundario line-through'
                              : 'text-amber-700'
                        }
                      >
                        {ETIQUETA_STATUS[op.status] ?? op.status}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {op.status !== 'disabled' && (
                        <DeshabilitarOperador
                          operadorId={op.id}
                          email={op.email}
                          deshabilitar={accionDeshabilitarOperador}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-texto-secundario">
              Las bajas son definitivas (nunca se borra la fila: la bitácora la referencia). El
              último operador activo no puede deshabilitarse.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Invitar operador</CardTitle>
          </CardHeader>
          <CardContent>
            <InvitarOperador invitar={accionInvitarOperador} />
            <p className="mt-3 text-xs text-texto-secundario">
              La persona recibe un correo con el enlace de alta: define contraseña y activa su app
              autenticadora (obligatoria) antes de poder operar. Una cuenta que pertenece a una
              empresa no puede ser operador (exclusión de identidad dual).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
