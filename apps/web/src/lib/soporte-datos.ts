import { clienteAdmin } from './supabase-admin';

// ALLOW-LIST de la vista de soporte (spec §6.5). Las páginas de app/admin/soporte/**
// consumen EXCLUSIVAMENTE este módulo (lint bidireccional en eslint.config.mjs): cada
// función selecciona columnas EXPLÍCITAS — nunca select('*') — y la frontera es la
// tabla de §6.5: el operador ES lado patronal (reglas 4 y 5 le aplican).
//
// NUNCA se selecciona aquí: responses · risk_results · gr1_results · registros 5.8 ·
// contenido de quejas · contenido de compliance_reports · summary de difusiones ·
// evidencias de Storage · token_hash de asignaciones.
//
// service_role justificado: el operador no es miembro del tenant (RLS no lo dejaría ver
// nada); la autorización real es autorizarSoporte() — nominativa, con evento por página.

export interface FichaSoporte {
  legalName: string;
  rfc: string | null;
  status: string;
  createdAt: string;
}

export async function fichaEmpresaSoporte(companyId: string): Promise<FichaSoporte | null> {
  const { data } = await clienteAdmin()
    .from('companies')
    .select('legal_name, rfc, status, created_at')
    .eq('id', companyId)
    .maybeSingle();
  if (!data) return null;
  return {
    legalName: data.legal_name,
    rfc: data.rfc,
    status: data.status,
    createdAt: data.created_at,
  };
}

export interface CentroSoporte {
  id: string;
  nombre: string;
  headcount: number;
  categoria: string;
}

export async function centrosSoporte(companyId: string): Promise<CentroSoporte[]> {
  const { data } = await clienteAdmin()
    .from('work_centers')
    .select('id, name, headcount, nom_category')
    .eq('company_id', companyId)
    .order('name');
  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.name,
    headcount: c.headcount,
    categoria: c.nom_category,
  }));
}

export interface EmpleadoEstadoSoporte {
  id: string;
  nombre: string;
  area: string | null;
  activo: boolean;
  centro: string;
  asignaciones: number;
  completadas: number;
}

/** Nombre, centro y ESTADO de asignación (conteos). Jamás token_hash ni respuestas. */
export async function empleadosEstadoSoporte(companyId: string): Promise<EmpleadoEstadoSoporte[]> {
  const admin = clienteAdmin();
  const [{ data: empleados }, { data: asignaciones }] = await Promise.all([
    admin
      .from('employees')
      .select('id, full_name, area, active, work_centers (name)')
      .eq('company_id', companyId)
      .order('full_name'),
    admin
      .from('questionnaire_assignments')
      .select('employee_id, completed_at')
      .eq('company_id', companyId),
  ]);
  const porEmpleado = new Map<string, { total: number; completadas: number }>();
  for (const a of asignaciones ?? []) {
    const acc = porEmpleado.get(a.employee_id) ?? { total: 0, completadas: 0 };
    acc.total++;
    if (a.completed_at) acc.completadas++;
    porEmpleado.set(a.employee_id, acc);
  }
  return (empleados ?? []).map((e) => ({
    id: e.id,
    nombre: e.full_name,
    area: e.area,
    activo: e.active,
    centro: (e.work_centers as unknown as { name: string })?.name ?? '—',
    asignaciones: porEmpleado.get(e.id)?.total ?? 0,
    completadas: porEmpleado.get(e.id)?.completadas ?? 0,
  }));
}

export interface CicloSoporte {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string | null;
  esEventoAts: boolean;
  asignaciones: number;
  completadas: number;
}

/** Fechas y conteos de participación por ciclo. Nada derivado de resultados. */
export async function ciclosConteosSoporte(companyId: string): Promise<CicloSoporte[]> {
  const admin = clienteAdmin();
  const [{ data: ciclos }, { data: asignaciones }] = await Promise.all([
    admin
      .from('compliance_cycles')
      .select('id, name, date_start, date_end, traumatic_event_id')
      .eq('company_id', companyId)
      .order('date_start', { ascending: false }),
    admin
      .from('questionnaire_assignments')
      .select('cycle_id, completed_at')
      .eq('company_id', companyId),
  ]);
  const porCiclo = new Map<string, { total: number; completadas: number }>();
  for (const a of asignaciones ?? []) {
    const acc = porCiclo.get(a.cycle_id) ?? { total: 0, completadas: 0 };
    acc.total++;
    if (a.completed_at) acc.completadas++;
    porCiclo.set(a.cycle_id, acc);
  }
  return (ciclos ?? []).map((c) => ({
    id: c.id,
    nombre: c.name,
    fechaInicio: c.date_start,
    fechaFin: c.date_end,
    esEventoAts: c.traumatic_event_id !== null,
    asignaciones: porCiclo.get(c.id)?.total ?? 0,
    completadas: porCiclo.get(c.id)?.completadas ?? 0,
  }));
}

export interface FlagSoporte {
  flag: string;
  enabled: boolean;
}

export async function flagsSoporte(companyId: string): Promise<FlagSoporte[]> {
  const { data } = await clienteAdmin()
    .from('feature_flags')
    .select('flag, enabled')
    .eq('company_id', companyId)
    .order('flag');
  return data ?? [];
}

export interface DifusionSoporte {
  id: string;
  cycleId: string;
  version: number;
  sha256: string;
  acuses: number;
}

/** METADATA de constancias de difusión + conteo de acuses. JAMÁS el summary. */
export async function difusionMetadataSoporte(companyId: string): Promise<DifusionSoporte[]> {
  const admin = clienteAdmin();
  const [{ data: constancias }, { data: acuses }] = await Promise.all([
    admin
      .from('dissemination_records')
      .select('id, cycle_id, version, sha256')
      .eq('company_id', companyId)
      .order('version', { ascending: false }),
    admin.from('dissemination_receipts').select('dissemination_id').eq('company_id', companyId),
  ]);
  const acusesPor = new Map<string, number>();
  for (const a of acuses ?? []) {
    acusesPor.set(a.dissemination_id, (acusesPor.get(a.dissemination_id) ?? 0) + 1);
  }
  return (constancias ?? []).map((d) => ({
    id: d.id,
    cycleId: d.cycle_id,
    version: d.version,
    sha256: d.sha256,
    acuses: acusesPor.get(d.id) ?? 0,
  }));
}

export interface ProgramaSoporte {
  id: string;
  cycleId: string;
  alcance: string;
  responsable: string;
  acciones: { descripcion: string; nivelOrigen: string; estatus: string; fecha: string | null }[];
}

/** METADATA del programa 8.3–8.5 y sus acciones. SIN rutas ni hashes de evidencias. */
export async function programaMetadataSoporte(companyId: string): Promise<ProgramaSoporte[]> {
  const admin = clienteAdmin();
  const [{ data: programas }, { data: acciones }] = await Promise.all([
    admin
      .from('intervention_programs')
      .select('id, cycle_id, scope_areas, responsible')
      .eq('company_id', companyId),
    admin
      .from('action_items')
      .select('cycle_id, description, origin_level, status, due_date')
      .eq('company_id', companyId),
  ]);
  return (programas ?? []).map((p) => ({
    id: p.id,
    cycleId: p.cycle_id,
    alcance: p.scope_areas,
    responsable: p.responsible,
    acciones: (acciones ?? [])
      .filter((a) => a.cycle_id === p.cycle_id)
      .map((a) => ({
        descripcion: a.description,
        nivelOrigen: a.origin_level,
        estatus: a.status,
        fecha: a.due_date,
      })),
  }));
}

export interface EventoBitacoraSoporte {
  id: string;
  actor: string;
  eventType: string;
  entity: string | null;
  createdAt: string;
}

/** Bitácora del tenant, paginada: es soporte de "¿qué pasó?". Sin details (pueden
 * referir entidades sensibles con más granularidad de la necesaria para soporte). */
export async function bitacoraTenantSoporte(
  companyId: string,
  pagina: number,
  porPagina: number,
): Promise<{ eventos: EventoBitacoraSoporte[]; total: number }> {
  const { data, count } = await clienteAdmin()
    .from('audit_log')
    .select('id, actor_user_id, event_type, entity, created_at', { count: 'exact' })
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .range((pagina - 1) * porPagina, pagina * porPagina - 1);
  return {
    eventos: (data ?? []).map((e) => ({
      id: e.id,
      actor: e.actor_user_id,
      eventType: e.event_type,
      entity: e.entity,
      createdAt: e.created_at,
    })),
    total: count ?? 0,
  };
}
