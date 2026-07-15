import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarSoporte } from '@/lib/autorizacion-plataforma';
import { empleadosEstadoSoporte } from '@/lib/soporte-datos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Soporte: empleados' };

export default async function PaginaSoporteEmpleados({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  await autorizarSoporte(companyId, 'empleados');
  const empleados = await empleadosEstadoSoporte(companyId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empleados y estado de participación</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-texto-secundario">
          Solo estructura y participación: las respuestas y los resultados individuales no son
          visibles para soporte (reglas 4 y 5 aplican al operador).
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs text-texto-secundario uppercase">
              <th className="py-2 pr-3">Nombre</th>
              <th className="py-2 pr-3">Centro</th>
              <th className="py-2 pr-3">Activo</th>
              <th className="py-2">Cuestionarios (completados/asignados)</th>
            </tr>
          </thead>
          <tbody>
            {empleados.map((e) => (
              <tr key={e.id} className="border-b border-borde/60">
                <td className="py-2 pr-3">{e.nombre}</td>
                <td className="py-2 pr-3">{e.centro}</td>
                <td className="py-2 pr-3">{e.activo ? 'Sí' : 'No'}</td>
                <td className="py-2 tabular-nums">
                  {e.completadas}/{e.asignaciones}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {empleados.length === 0 && (
          <p className="py-4 text-sm text-texto-secundario">Sin empleados registrados.</p>
        )}
      </CardContent>
    </Card>
  );
}
