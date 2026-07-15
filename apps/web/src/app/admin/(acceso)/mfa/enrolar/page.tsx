import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EnrolarMfaAdmin } from '@/components/admin/mfa-admin-cliente';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usuarioActual } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Verificación en dos pasos' };

/** Enrolamiento FORZADO (spec §1.4): sin factor TOTP no hay camino a /admin. */
export default async function PaginaEnrolarMfaAdmin() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/admin/ingresar');

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Activa tu segundo factor</CardTitle>
      </CardHeader>
      <CardContent>
        <EnrolarMfaAdmin />
      </CardContent>
    </Card>
  );
}
