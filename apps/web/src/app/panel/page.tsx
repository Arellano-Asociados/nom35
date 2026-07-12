import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { membresiasDe } from '@/lib/autorizacion';
import { usuarioActual } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';

const ETIQUETA_ROL: Record<string, string> = {
  admin_org: 'Admin de Organización',
  consultor: 'Consultor',
  miembro: 'Miembro',
};

export default async function PaginaPanel() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/ingresar');
  const membresias = await membresiasDe(usuario.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis empresas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {membresias.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
            Aún no perteneces a ninguna empresa. Registra la primera con el enlace de abajo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="lista-empresas">
            {membresias.map((m) => (
              <li key={`${m.companyId}-${m.rol}`}>
                <Link
                  href={`/panel/${m.companyId}/centros`}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{m.razonSocial}</span>
                  <span className="text-slate-500">
                    {ETIQUETA_ROL[m.rol]}
                    {m.esResponsableDesignado ? ' · Responsable Designado' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/panel/nueva" className="text-sm font-medium text-blue-700 underline">
          Registrar una empresa nueva
        </Link>
      </CardContent>
    </Card>
  );
}
