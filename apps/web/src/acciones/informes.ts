'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { registrarAuditoria } from '@/lib/auditoria';
import {
  armarDatosInforme79,
  type EntradaAccion,
  type EntradaAsignacion,
  type EntradaCentro,
  type EntradaResultado,
  type EntradaResultadoGr1,
  type NomCategory,
} from '@/lib/informe';
import { clienteAdmin } from '@/lib/supabase-admin';
import { generarPdfInforme79 } from '@/informes/generar-pdf';

// Acciones de servidor del informe normativo 7.9. Igual que en panel.ts: TODA acción
// verifica la membresía real del usuario en la empresa (autorizarEmpresa) antes de tocar
// datos, y el cicloId que llega de la URL/caller se valida contra companyId (regla
// inviolable 6). El informe solo contiene datos agregados (distribuciones, conteos) —
// nunca respuestas ni resultados individuales (regla inviolable 4) — por lo que el nivel
// de autorización de "gestión" (admin_org o consultor) usado ya para el dashboard agregado
// es el adecuado, no el de Responsable Designado.

export type ResultadoGenerarInforme =
  { ok: true; reporteId: string } | { ok: false; error: string };
export type ResultadoUrlDescarga = { ok: true; url: string } | { ok: false; error: string };

export async function accionGenerarInforme79(
  companyId: string,
  cycleId: string,
): Promise<ResultadoGenerarInforme> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: 'Sin permisos' };

  const supabase = clienteAdmin();

  const { data: empresa } = await supabase
    .from('companies')
    .select('legal_name, rfc')
    .eq('id', companyId)
    .maybeSingle();
  if (!empresa) return { ok: false, error: 'Empresa no encontrada' };

  // El ciclo se busca SIEMPRE filtrado por companyId: un cycleId de otra empresa no
  // produce fila (FK compuesta company_id+id en la cadena de tenant).
  const { data: ciclo } = await supabase
    .from('compliance_cycles')
    .select(
      'name, date_start, date_end, evaluator_name, evaluator_license, work_center_id, work_centers (name, address, main_activity, headcount, nom_category)',
    )
    .eq('company_id', companyId)
    .eq('id', cycleId)
    .maybeSingle();
  if (!ciclo) return { ok: false, error: 'Ciclo no encontrado' };

  const centroFila = ciclo.work_centers as unknown as {
    name: string;
    address: string | null;
    main_activity: string | null;
    headcount: number;
    nom_category: NomCategory;
  };
  const centros: EntradaCentro[] = [
    {
      nombre: centroFila.name,
      domicilio: centroFila.address,
      actividad: centroFila.main_activity,
      headcount: centroFila.headcount,
      nomCategory: centroFila.nom_category,
    },
  ];

  const { data: asignacionesFilas } = await supabase
    .from('questionnaire_assignments')
    .select('id, completed_at')
    .eq('company_id', companyId)
    .eq('cycle_id', cycleId);
  const asignaciones: EntradaAsignacion[] = (asignacionesFilas ?? []).map((a) => ({
    id: a.id,
    completada: a.completed_at !== null,
  }));

  // Historial completo de risk_results del ciclo (incluye superseded): armarDatosInforme79
  // hace su propio filtrado de vigencia (supersedes_id), así que no se pre-filtra aquí.
  const { data: resultadosFilas } = await supabase
    .from('risk_results')
    .select(
      'id, assignment_id, supersedes_id, created_at, nivel_final, categorias, dominios, engine_version',
    )
    .eq('company_id', companyId)
    .eq('cycle_id', cycleId);
  const resultadosVigentes: EntradaResultado[] = (resultadosFilas ?? []).map((r) => ({
    id: r.id,
    assignmentId: r.assignment_id,
    supersedesId: r.supersedes_id,
    createdAt: r.created_at,
    nivelFinal: r.nivel_final,
    categorias: r.categorias ?? [],
    dominios: r.dominios ?? [],
    engineVersion: r.engine_version,
  }));

  const { data: gr1Filas } = await supabase
    .from('gr1_results')
    .select('assignment_id, requiere_valoracion')
    .eq('company_id', companyId)
    .eq('cycle_id', cycleId);
  const resultadosGr1: EntradaResultadoGr1[] = (gr1Filas ?? []).map((g) => ({
    assignmentId: g.assignment_id,
    requiereValoracion: g.requiere_valoracion,
  }));

  const { data: accionesFilas } = await supabase
    .from('action_items')
    .select('description, origin_level, responsible, due_date, status')
    .eq('company_id', companyId)
    .eq('cycle_id', cycleId);
  const acciones: EntradaAccion[] = (accionesFilas ?? []).map((a) => ({
    descripcion: a.description,
    nivelOrigen: a.origin_level,
    responsable: a.responsible,
    fechaCompromiso: a.due_date,
    estatus: a.status,
  }));

  const datos = armarDatosInforme79({
    empresa: { razonSocial: empresa.legal_name, rfc: empresa.rfc },
    centros,
    ciclo: {
      nombre: ciclo.name,
      fechaInicio: ciclo.date_start,
      fechaFin: ciclo.date_end,
      evaluadorNombre: ciclo.evaluator_name,
      evaluadorCedula: ciclo.evaluator_license,
    },
    asignaciones,
    resultadosVigentes,
    resultadosGr1,
    acciones,
    generadoEl: new Date().toISOString(),
  });

  let pdf: Buffer;
  try {
    pdf = await generarPdfInforme79(datos);
  } catch {
    return { ok: false, error: 'No se pudo generar el PDF del informe' };
  }
  const sha256 = createHash('sha256').update(pdf).digest('hex');

  const rutaArchivo = `informes/${companyId}/${cycleId}/informe-79-${Date.now()}.pdf`;
  const { error: errorSubida } = await supabase.storage
    .from('informes')
    .upload(rutaArchivo, pdf, { contentType: 'application/pdf' });
  if (errorSubida) return { ok: false, error: 'No se pudo subir el informe' };

  const { data: reporte, error: errorInsert } = await supabase
    .from('compliance_reports')
    .insert({
      company_id: companyId,
      cycle_id: cycleId,
      report_type: 'informe_79',
      storage_path: rutaArchivo,
      sha256,
    })
    .select('id')
    .single();
  if (errorInsert || !reporte) return { ok: false, error: 'No se pudo registrar el informe' };

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'informe_generado',
    'compliance_reports',
    reporte.id,
    { cycleId, sha256 },
  );

  revalidatePath(`/panel/${companyId}/ciclos/${cycleId}/informes`);
  return { ok: true, reporteId: reporte.id };
}

export async function accionUrlDescargaInforme(
  companyId: string,
  reporteId: string,
): Promise<ResultadoUrlDescarga> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: 'Sin permisos' };

  const supabase = clienteAdmin();
  // reporteId se verifica SIEMPRE contra companyId: nunca se confía en el id solo.
  const { data: reporte } = await supabase
    .from('compliance_reports')
    .select('storage_path')
    .eq('company_id', companyId)
    .eq('id', reporteId)
    .maybeSingle();
  if (!reporte) return { ok: false, error: 'Informe no encontrado' };

  const { data: firmado, error } = await supabase.storage
    .from('informes')
    .createSignedUrl(reporte.storage_path, 60);
  if (error || !firmado) return { ok: false, error: 'No se pudo generar el enlace de descarga' };

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'informe_descargado',
    'compliance_reports',
    reporteId,
    {},
  );

  return { ok: true, url: firmado.signedUrl };
}
