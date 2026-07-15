import { clienteAdmin } from './supabase-admin';

// Lector de las vistas de métricas de plataforma (spec §5). service_role justificado:
// las vistas tienen GRANT exclusivo a service_role — la frontera de columnas vive en la
// migración, no aquí. Siempre tras autorizarPlataforma().

export interface MetricaOrganizacion {
  id: string;
  legalName: string;
  status: string;
  centros: number;
  empleados: number;
}

export interface MetricaCiclo {
  id: string;
  companyId: string;
  esEventoAts: boolean;
  asignaciones: number;
  completadas: number;
  activo: boolean;
}

export interface MetricasPlataforma {
  organizaciones: MetricaOrganizacion[];
  porEstado: Record<string, number>;
  totalEmpleados: number;
  ciclos: { total: number; enCurso: number; ats: number };
  participacion: { asignaciones: number; completadas: number };
}

export async function metricasPlataforma(): Promise<MetricasPlataforma> {
  const admin = clienteAdmin();
  const [{ data: orgs }, { data: ciclos }] = await Promise.all([
    admin
      .from('plataforma_metricas_organizaciones')
      .select('id, legal_name, status, centros, empleados')
      .order('legal_name'),
    admin
      .from('plataforma_metricas_ciclos')
      .select('id, company_id, date_end, es_evento_ats, asignaciones, completadas'),
  ]);

  const organizaciones: MetricaOrganizacion[] = (orgs ?? []).map((o) => ({
    id: o.id,
    legalName: o.legal_name,
    status: o.status,
    centros: Number(o.centros),
    empleados: Number(o.empleados),
  }));

  const porEstado: Record<string, number> = {};
  let totalEmpleados = 0;
  for (const o of organizaciones) {
    porEstado[o.status] = (porEstado[o.status] ?? 0) + 1;
    totalEmpleados += o.empleados;
  }

  let asignaciones = 0;
  let completadas = 0;
  let enCurso = 0;
  let ats = 0;
  for (const c of ciclos ?? []) {
    asignaciones += Number(c.asignaciones);
    completadas += Number(c.completadas);
    if (!c.date_end || new Date(c.date_end).getTime() >= Date.now()) enCurso++;
    if (c.es_evento_ats) ats++;
  }

  return {
    organizaciones,
    porEstado,
    totalEmpleados,
    ciclos: { total: (ciclos ?? []).length, enCurso, ats },
    participacion: { asignaciones, completadas },
  };
}
