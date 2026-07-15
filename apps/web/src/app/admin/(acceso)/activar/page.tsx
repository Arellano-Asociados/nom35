import type { Metadata } from 'next';
import { ActivarAdmin } from '@/components/admin/activar-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Activar cuenta de operación' };

// Destino del enlace de invitación (inviteUserByEmail). Sin chequeo de sesión del lado
// servidor A PROPÓSITO: la sesión del enlace llega en el fragmento de la URL, que el
// servidor jamás ve; el componente cliente la procesa y decide.
export default function PaginaActivarOperador() {
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
