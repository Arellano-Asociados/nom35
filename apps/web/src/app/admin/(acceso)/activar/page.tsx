import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ActivarAdmin } from '@/components/admin/activar-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usuarioActual } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Activar cuenta de operación' };

/** Destino del enlace de invitación (inviteUserByEmail): el enlace ya trae sesión. */
export default async function PaginaActivarOperador() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/admin/ingresar');

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Activa tu cuenta de operación</CardTitle>
      </CardHeader>
      <CardContent>
        <ActivarAdmin />
      </CardContent>
    </Card>
  );
}
