import type { Metadata } from 'next';
import Link from 'next/link';
import { accionCrearEmpresaPlataforma } from '@/acciones/plataforma';
import { CrearOrganizacion } from '@/components/admin/organizaciones-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarPlataforma } from '@/lib/autorizacion-plataforma';
import { ETIQUETA_ESTADO } from '@/lib/estados-empresa';
import { clienteAdmin } from '@/lib/supabase-admin';
import { fechaEsMx } from '@/lib/fechas';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Organizaciones' };

export default async function PaginaOrganizaciones() {
  await autorizarPlataforma();

  // service_role justificado: el directorio cross-tenant de organizaciones es una
  // superficie exclusiva del portal (ninguna sesión tiene SELECT sobre todas).
  const { data: empresas } = await clienteAdmin()
    .from('companies')
    .select('id, legal_name, rfc, status, created_at, status_changed_at')
    .order('created_at', { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-texto">Organizaciones</h1>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Directorio</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs text-texto-secundario uppercase">
                  <th className="py-2 pr-3">Razón social</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Alta</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(empresas ?? []).map((e) => {
                  const estado = ETIQUETA_ESTADO[e.status] ?? {
                    texto: e.status,
                    clase: 'text-texto-secundario',
                  };
                  return (
                    <tr key={e.id} className="border-b border-borde/60">
                      <td className="py-2 pr-3">{e.legal_name}</td>
                      <td className={`py-2 pr-3 font-medium ${estado.clase}`}>{estado.texto}</td>
                      <td className="py-2 pr-3 text-texto-secundario">{fechaEsMx(e.created_at)}</td>
                      <td className="py-2 text-right">
                        <Link
                          href={`/admin/organizaciones/${e.id}`}
                          className="text-marca-700 underline"
                          data-testid={`ficha-${e.id}`}
                        >
                          Ficha
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(empresas ?? []).length === 0 && (
              <p className="py-4 text-sm text-texto-secundario">Aún no hay organizaciones.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alta operada</CardTitle>
          </CardHeader>
          <CardContent>
            <CrearOrganizacion crear={accionCrearEmpresaPlataforma} />
            <p className="mt-3 text-xs text-texto-secundario">
              El administrador recibe un correo de invitación: define su contraseña y entra al panel
              con su empresa ya creada. El registro autoservicio sigue disponible en paralelo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
