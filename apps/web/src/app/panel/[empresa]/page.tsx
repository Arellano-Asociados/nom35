import Link from 'next/link';
import { DashboardEjecutivo } from '@/components/panel/dashboard-ejecutivo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteSesion } from '@/lib/supabase-servidor';
import { mostrarTablero } from '@/lib/tablero';

export const dynamic = 'force-dynamic';

// Inicio del panel (Fase 6): dashboard ejecutivo cuando la empresa ya opera (≥1 ciclo con
// asignaciones distribuidas); mientras tanto, el checklist de primer uso (auditoría v0,
// dimensión 4 [Alto]: "cero onboarding"). Cada paso del checklist dice qué es, por qué lo
// pide la norma y lleva directo a resolverlo.
export default async function PaginaInicioEmpresa({
  params,
}: {
  params: Promise<{ empresa: string }>;
}) {
  const { empresa } = await params;
  await autorizarEmpresa(empresa);

  const supabase = await clienteSesion();
  const contar = async (tabla: string) => {
    const { count } = await supabase
      .from(tabla)
      .select('id', { count: 'exact', head: true })
      .eq('company_id', empresa);
    return count ?? 0;
  };
  const [centros, empleados, politicas, ciclos, asignaciones] = await Promise.all([
    contar('work_centers'),
    contar('employees'),
    contar('policies'),
    contar('compliance_cycles'),
    contar('questionnaire_assignments'),
  ]);

  if (mostrarTablero({ ciclos, asignaciones })) {
    return <DashboardEjecutivo empresa={empresa} />;
  }

  const PASOS = [
    {
      hecho: centros > 0,
      titulo: 'Crea tu primer centro de trabajo',
      porQue:
        'El número de trabajadores del centro decide qué cuestionarios exige la norma (hasta 15, de 16 a 50, o más de 50).',
      href: `/panel/${empresa}/centros`,
      cta: 'Ir a Centros',
    },
    {
      hecho: empleados > 0,
      titulo: 'Carga a tus empleados',
      porQue:
        'La evaluación es censal: todos los trabajadores del centro reciben su cuestionario. Puedes copiarlos desde Excel.',
      href: `/panel/${empresa}/empleados`,
      cta: 'Ir a Empleados',
    },
    {
      hecho: politicas > 0,
      titulo: 'Publica tu política de prevención',
      porQue:
        'Es obligatoria para todos los centros y su difusión genera evidencia: cada empleado registra su acuse al responder.',
      href: `/panel/${empresa}/politica`,
      cta: 'Ir a Política',
    },
    {
      hecho: ciclos > 0,
      titulo: 'Crea un ciclo de evaluación',
      porQue:
        'El ciclo agrupa la aplicación de cuestionarios y toda su evidencia (resultados, informe y expediente).',
      href: `/panel/${empresa}/ciclos`,
      cta: 'Ir a Ciclos',
    },
    {
      hecho: asignaciones > 0,
      titulo: 'Distribuye los cuestionarios',
      porQue:
        'Cada empleado recibe por correo un enlace personal y confidencial: nadie de la empresa puede ver sus respuestas.',
      href: `/panel/${empresa}/ciclos`,
      cta: 'Abrir el ciclo',
    },
  ] as const;

  const completados = PASOS.filter((p) => p.hecho).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Primeros pasos</CardTitle>
        <span className="text-sm text-texto-secundario tabular-nums">
          {completados} de {PASOS.length} completados
        </span>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-4">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo} className="flex gap-3">
              <span
                aria-hidden="true"
                className={
                  paso.hecho
                    ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-exito text-xs font-bold text-white'
                    : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-borde-control text-xs font-semibold text-texto-secundario'
                }
              >
                {paso.hecho ? '✓' : i + 1}
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-texto">
                  {paso.titulo}
                  {paso.hecho && <span className="sr-only"> (completado)</span>}
                </p>
                <p className="text-sm text-texto-secundario">{paso.porQue}</p>
                {!paso.hecho && (
                  <Link
                    href={paso.href}
                    className="text-sm font-medium text-marca-700 underline hover:text-marca-800"
                  >
                    {paso.cta}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
