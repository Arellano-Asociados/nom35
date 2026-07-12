import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function PaginaIndividual({
  params,
}: {
  params: Promise<{ empresa: string; ciclo: string }>;
}) {
  const { empresa, ciclo } = await params;
  const acceso = await autorizarEmpresa(empresa);

  if (!acceso.membresia.esResponsableDesignado) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-700" data-testid="individual-restringido">
          Los resultados individuales solo puede consultarlos el{' '}
          <strong>Responsable Designado</strong>.
        </CardContent>
      </Card>
    );
  }

  const { data: resultados } = await clienteAdmin()
    .from('risk_results')
    .select('employee_id, employees (full_name, area)')
    .eq('company_id', empresa)
    .eq('cycle_id', ciclo);

  const empleados = new Map<string, { nombre: string; area: string | null }>();
  for (const r of resultados ?? []) {
    const e = r.employees as unknown as { full_name: string; area: string | null };
    empleados.set(r.employee_id, { nombre: e.full_name, area: e.area });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultados individuales procesados</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          Cada consulta de un resultado individual queda registrada en la bitácora de auditoría.
        </p>
        <ul className="flex flex-col gap-2" data-testid="lista-individual">
          {[...empleados.entries()].map(([id, e]) => (
            <li key={id}>
              <Link
                href={`/panel/${empresa}/ciclos/${ciclo}/individual/${id}`}
                className="block rounded-md border border-slate-200 px-4 py-3 text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{e.nombre}</span>{' '}
                <span className="text-slate-500">· {e.area ?? 'Sin área'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
