import { resultadosVigentesPorAsignacion } from './informe';
// Uso justificado de service_role (CLAUDE.md §2): la constancia de difusión se arma
// AGREGANDO risk_results — tabla sin GRANT para authenticated (reglas 4/5) — igual que
// el dashboard. Este módulo solo devuelve la ENTRADA agregada con supresión aplicada
// por lib/difusion.ts antes de cualquier render o persistencia; jamás expone filas.
import { clienteAdmin } from './supabase-admin';
import type { EntradaDifusion } from './difusion';

interface PuntuadoJson {
  nombre: string;
  nivel: string;
}

export type ResultadoEntradaDifusion =
  { ok: true; entrada: EntradaDifusion } | { ok: false; error: string };

/**
 * Lee de BD todo lo necesario para `armarResumenDifusion`. Compartido por la vista
 * previa del panel y por `accionPublicarDifusion` (lo publicado es EXACTAMENTE lo
 * previsualizado, recalculado en el momento de publicar). companyId y cicloId se
 * validan juntos en cada consulta (regla inviolable 6).
 */
export async function armarEntradaDifusionDesdeBd(
  companyId: string,
  cicloId: string,
): Promise<ResultadoEntradaDifusion> {
  const supabase = clienteAdmin();

  const { data: ciclo } = await supabase
    .from('compliance_cycles')
    .select('name, date_start, date_end, work_centers (name)')
    .eq('company_id', companyId)
    .eq('id', cicloId)
    .maybeSingle();
  if (!ciclo) return { ok: false, error: 'Ciclo no encontrado' };

  const { data: empresa } = await supabase
    .from('companies')
    .select('legal_name')
    .eq('id', companyId)
    .maybeSingle();
  if (!empresa) return { ok: false, error: 'Empresa no encontrada' };

  const [{ data: resultados }, { data: asignaciones }, { count: acciones }] = await Promise.all([
    supabase
      .from('risk_results')
      .select('id, assignment_id, supersedes_id, created_at, nivel_final, categorias')
      .eq('company_id', companyId)
      .eq('cycle_id', cicloId),
    supabase
      .from('questionnaire_assignments')
      .select('employee_id, completed_at, questionnaires (code)')
      .eq('company_id', companyId)
      .eq('cycle_id', cicloId),
    supabase
      .from('action_items')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('cycle_id', cicloId),
  ]);

  // Mismo criterio de vigencia que dashboard e informe (regla inviolable 1).
  const vigentes = resultadosVigentesPorAsignacion(
    (resultados ?? []).map((r) => ({
      id: r.id,
      assignmentId: r.assignment_id,
      supersedesId: r.supersedes_id,
      createdAt: r.created_at,
      nivel_final: r.nivel_final,
      categorias: r.categorias,
    })),
  );

  // Participación por PERSONA (no por asignación): un empleado puede tener dos
  // cuestionarios (GR-I + GR-II/III) y en el aviso al trabajador se habla de personas.
  const invitados = new Set((asignaciones ?? []).map((a) => a.employee_id));
  const completaron = new Set(
    (asignaciones ?? []).filter((a) => a.completed_at !== null).map((a) => a.employee_id),
  );
  const guias = [
    ...new Set(
      (asignaciones ?? [])
        .map((a) => (a.questionnaires as unknown as { code: string } | null)?.code)
        .filter(
          (c): c is 'GR-I' | 'GR-II' | 'GR-III' => c === 'GR-I' || c === 'GR-II' || c === 'GR-III',
        ),
    ),
  ].sort();

  // Enlace del buzón (5.7 d): solo si la empresa ya lo activó y hay URL base.
  let urlBuzon: string | undefined;
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (base) {
    const { data: buzon } = await supabase
      .from('complaint_boxes')
      .select('token')
      .eq('company_id', companyId)
      .maybeSingle();
    if (buzon?.token) urlBuzon = `${base}/buzon/${buzon.token}`;
  }

  return {
    ok: true,
    entrada: {
      empresa: empresa.legal_name,
      ciclo: ciclo.name,
      centroTrabajo: (ciclo.work_centers as unknown as { name: string }).name,
      fechaInicio: ciclo.date_start,
      fechaFin: ciclo.date_end,
      guias,
      nivelesFinales: vigentes.map((r) => r.nivel_final),
      categorias: vigentes.flatMap((r) =>
        (r.categorias as PuntuadoJson[]).map((c) => ({ nombre: c.nombre, nivel: c.nivel })),
      ),
      participacion: { asignados: invitados.size, completados: completaron.size },
      accionesComprometidas: acciones ?? 0,
      ...(urlBuzon ? { urlBuzon } : {}),
    },
  };
}
