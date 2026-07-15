import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarPlataforma } from '@/lib/autorizacion-plataforma';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Operación de plataforma' };

// Portada del portal. Las métricas operativas (vistas dedicadas de §5 del spec) llegan
// en la tarea 8; esta página ya cumple la convención de autorización.

export default async function PaginaPortalAdmin() {
  const operador = await autorizarPlataforma();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-texto">Operación de plataforma</h1>
      <p className="text-sm text-texto-secundario">
        Sesión de operación de <span className="font-medium">{operador.email}</span>. Todas tus
        acciones quedan registradas en la bitácora de plataforma; las que tocan a una organización
        quedan además en la bitácora de esa organización.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organizaciones</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-texto-secundario">
            Alta operada, suspensión, reactivación y baja con retención.{' '}
            <Link href="/admin/organizaciones" className="text-marca-700 underline">
              Ir a organizaciones
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Operadores</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-texto-secundario">
            Invitaciones y bajas del equipo de operación.{' '}
            <Link href="/admin/operadores" className="text-marca-700 underline">
              Ir a operadores
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
