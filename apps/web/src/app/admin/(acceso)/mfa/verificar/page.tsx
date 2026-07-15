import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VerificarMfaAdmin } from '@/components/admin/mfa-admin-cliente';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usuarioActual } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Verificación en dos pasos' };

/** Re-verificación TOTP: sube a aal2 o refresca la ventana de 4 horas (spec §1.5). */
export default async function PaginaVerificarMfaAdmin() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/admin/ingresar');

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Confirma tu identidad</CardTitle>
      </CardHeader>
      <CardContent>
        <VerificarMfaAdmin />
      </CardContent>
    </Card>
  );
}
