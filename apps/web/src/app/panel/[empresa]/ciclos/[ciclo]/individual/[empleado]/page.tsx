import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { registrarAuditoriaEstricta } from '@/lib/auditoria';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const ETIQUETA_NIVEL: Record<string, string> = {
  nulo: 'Nulo',
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  muy_alto: 'Muy alto',
};

interface PuntuadoJson {
  nombre: string;
  puntaje: number;
  nivel: string;
}

// Acceso individual del Responsable Designado (regla inviolable 5):
// interstitial de advertencia y, en CADA renderizado del resultado, evento
// individual_result_access en audit_log. Recargar la página = nueva consulta auditada.
export default async function PaginaResultadoIndividual({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string; ciclo: string; empleado: string }>;
  searchParams: Promise<{ confirmar?: string }>;
}) {
  const { empresa, ciclo, empleado } = await params;
  const { confirmar } = await searchParams;
  const acceso = await autorizarEmpresa(empresa);

  if (!acceso.membresia.esResponsableDesignado) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-700">
          Los resultados individuales solo puede consultarlos el Responsable Designado.
        </CardContent>
      </Card>
    );
  }

  if (confirmar !== '1') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aviso antes de continuar</CardTitle>
        </CardHeader>
        <CardContent
          className="flex flex-col gap-4 text-sm text-slate-700"
          data-testid="interstitial"
        >
          <p>
            Estás por consultar el <strong>resultado individual procesado</strong> de un trabajador:
            es un dato personal sensible.
          </p>
          <ul className="list-disc pl-5">
            <li>Esta consulta quedará registrada en la bitácora de auditoría con tu usuario.</li>
            <li>Úsala solo para los fines de la NOM-035 (canalización y seguimiento).</li>
            <li>Las respuestas crudas del cuestionario no son visibles para nadie.</li>
          </ul>
          <Link
            href={`/panel/${empresa}/ciclos/${ciclo}/individual/${empleado}?confirmar=1`}
            data-testid="confirmar-acceso"
            className="inline-flex h-11 w-fit items-center rounded-md bg-blue-700 px-5 text-sm font-medium text-white hover:bg-blue-800"
          >
            Entiendo, consultar resultado
          </Link>
        </CardContent>
      </Card>
    );
  }

  const supabase = clienteAdmin();
  const [{ data: resultado }, { data: datosEmpleado }] = await Promise.all([
    supabase
      .from('risk_results')
      .select('id, cfinal, nivel_final, categorias, dominios, created_at')
      .eq('company_id', empresa)
      .eq('cycle_id', ciclo)
      .eq('employee_id', empleado)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('employees')
      .select('full_name, area')
      .eq('company_id', empresa)
      .eq('id', empleado)
      .maybeSingle(),
  ]);

  if (!resultado || !datosEmpleado) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-700">
          No hay resultado procesado para este trabajador en el ciclo.
        </CardContent>
      </Card>
    );
  }

  // Evento de auditoría OBLIGATORIO en cada consulta (regla inviolable 5): variante estricta,
  // si el INSERT falla NO se muestra el resultado ("sin evento no hay consulta").
  const auditoriaRegistrada = await registrarAuditoriaEstricta(
    empresa,
    acceso.userId,
    'individual_result_access',
    'risk_results',
    resultado.id,
    { employee_id: empleado, cycle_id: ciclo },
  );

  if (!auditoriaRegistrada) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-700" data-testid="error-auditoria">
          No fue posible registrar la consulta en la bitácora de auditoría; por protección de los
          datos, el resultado no puede mostrarse. Intenta de nuevo.
        </CardContent>
      </Card>
    );
  }

  const categorias = resultado.categorias as PuntuadoJson[];
  const dominios = resultado.dominios as PuntuadoJson[];

  return (
    <Card>
      <CardHeader>
        <CardTitle data-testid="titulo-individual">
          Resultado de {datosEmpleado.full_name} ({datosEmpleado.area ?? 'Sin área'})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="rounded-md bg-amber-50 p-3 text-amber-900">
          Consulta registrada en la bitácora de auditoría.
        </p>
        <p className="text-slate-800">
          Calificación final: <strong>{Number(resultado.cfinal)}</strong> · Nivel:{' '}
          <strong data-testid="nivel-individual">
            {ETIQUETA_NIVEL[resultado.nivel_final] ?? resultado.nivel_final}
          </strong>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 font-semibold text-slate-900">Categorías</h3>
            <ul className="flex flex-col gap-1 text-slate-700">
              {categorias.map((c) => (
                <li key={c.nombre}>
                  {c.nombre}: {ETIQUETA_NIVEL[c.nivel] ?? c.nivel} ({c.puntaje})
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-slate-900">Dominios</h3>
            <ul className="flex flex-col gap-1 text-slate-700">
              {dominios.map((d) => (
                <li key={d.nombre}>
                  {d.nombre}: {ETIQUETA_NIVEL[d.nivel] ?? d.nivel} ({d.puntaje})
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
