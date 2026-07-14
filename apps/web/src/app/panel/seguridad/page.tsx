import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ConfiguracionMfa } from '@/components/acceso/configuracion-mfa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usuarioActual } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Seguridad' };

export default async function PaginaSeguridad() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/ingresar');

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Seguridad de tu cuenta</CardTitle>
      </CardHeader>
      <CardContent>
        <ConfiguracionMfa />
      </CardContent>
    </Card>
  );
}
