'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { registrarAuditoria } from '@/lib/auditoria';
import {
  armarDatosInforme79,
  type DatosInforme79,
  type EntradaAccion,
  type EntradaAsignacion,
  type EntradaCentro,
  type EntradaResultado,
  type EntradaResultadoGr1,
  type NomCategory,
} from '@/lib/informe';
import { clienteAdmin } from '@/lib/supabase-admin';
import { generarPdfInforme79 } from '@/informes/generar-pdf';
import {
  armarExpediente,
  type EntradaAcusePolitica,
  type EntradaCapacitacion,
  type EntradaParticipacionCentro,
  type EntradaPoliticaArchivo,
} from '@/informes/expediente';

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

type ResultadoArmadoDatos = { ok: true; datos: DatosInforme79 } | { ok: false; error: string };

/**
 * Lee de BD todo lo necesario para `armarDatosInforme79` y lo arma. Compartido por
 * `accionGenerarInforme79` y `accionGenerarExpediente` (el expediente incluye el mismo
 * informe 7.9 más evidencia de proceso) para no duplicar las ~10 consultas de tenant.
 * companyId Y cycleId se validan juntos en cada consulta (regla inviolable 6): un
 * cycleId de otra empresa nunca produce fila (FK compuesta company_id+id).
 */
async function armarDatosInforme79DesdeBd(
  supabase: SupabaseClient,
  companyId: string,
  cycleId: string,
): Promise<ResultadoArmadoDatos> {
  const { data: empresa } = await supabase
    .from('companies')
    .select('legal_name, rfc')
    .eq('id', companyId)
    .maybeSingle();
  if (!empresa) return { ok: false, error: 'Empresa no encontrada' };

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

  return { ok: true, datos };
}

export async function accionGenerarInforme79(
  companyId: string,
  cycleId: string,
): Promise<ResultadoGenerarInforme> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: 'Sin permisos' };

  const supabase = clienteAdmin();

  const armado = await armarDatosInforme79DesdeBd(supabase, companyId, cycleId);
  if (!armado.ok) return { ok: false, error: armado.error };
  const { datos } = armado;

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

type ResultadoPoliticaPublicada =
  { ok: true; politica: EntradaPoliticaArchivo | null } | { ok: false; error: string };

/**
 * Política de prevención actualmente publicada de la empresa (la más reciente por
 * `published_at`) y sus bytes desde el bucket privado `politicas`. `{ ok: true, politica:
 * null }` si la empresa aún no ha publicado ninguna (el expediente se genera igual; el
 * manifiesto lo marca "ausente" — no truena, ver `armarExpediente`). Si SÍ existe una
 * política publicada pero su archivo no se puede descargar del storage, se distingue
 * ese caso con `{ ok: false }`: el expediente es evidencia ante la STPS y no debe
 * generarse marcando "ausente" una política que en realidad existe pero no se pudo
 * recuperar.
 */
async function politicaPublicadaDesdeBd(
  supabase: SupabaseClient,
  companyId: string,
): Promise<ResultadoPoliticaPublicada> {
  const { data: politica } = await supabase
    .from('policies')
    .select('storage_path')
    .eq('company_id', companyId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!politica) return { ok: true, politica: null };

  const { data: descarga, error } = await supabase.storage
    .from('politicas')
    .download(politica.storage_path);
  if (error || !descarga) {
    return {
      ok: false,
      error: 'No se pudo recuperar el archivo de la política de prevención publicada',
    };
  }

  const bytes = Buffer.from(await descarga.arrayBuffer());
  return { ok: true, politica: { nombreArchivo: politica.storage_path, bytes } };
}

export async function accionGenerarExpediente(
  companyId: string,
  cycleId: string,
): Promise<ResultadoGenerarInforme> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: 'Sin permisos' };

  const supabase = clienteAdmin();

  const armado = await armarDatosInforme79DesdeBd(supabase, companyId, cycleId);
  if (!armado.ok) return { ok: false, error: armado.error };
  const { datos } = armado;

  let pdf: Buffer;
  try {
    pdf = await generarPdfInforme79(datos);
  } catch {
    return { ok: false, error: 'No se pudo generar el PDF del informe' };
  }

  const resultadoPolitica = await politicaPublicadaDesdeBd(supabase, companyId);
  if (!resultadoPolitica.ok) return { ok: false, error: resultadoPolitica.error };
  const { politica } = resultadoPolitica;

  // Evidencia de PROCESO, no de resultado (reglas inviolables 3 y 4): nombre + fecha
  // únicamente, nada de risk_results/gr1_results/responses se toca aquí.
  const { data: acusesFilas } = await supabase
    .from('policy_acknowledgments')
    .select('acknowledged_at, employees (full_name)')
    .eq('company_id', companyId);
  const acusesPolitica: EntradaAcusePolitica[] = (acusesFilas ?? []).map((a) => ({
    nombreEmpleado: (a.employees as unknown as { full_name: string } | null)?.full_name ?? '',
    fechaAcuse: a.acknowledged_at,
  }));

  const { data: capacitacionFilas } = await supabase
    .from('training_records')
    .select('completed_at, employees (full_name), training_contents (title)')
    .eq('company_id', companyId);
  const capacitacion: EntradaCapacitacion[] = (capacitacionFilas ?? []).map((t) => ({
    nombreEmpleado: (t.employees as unknown as { full_name: string } | null)?.full_name ?? '',
    nombreCapacitacion: (t.training_contents as unknown as { title: string } | null)?.title ?? '',
    fechaCompletado: t.completed_at,
    estatus: 'completado',
  }));

  // Un ciclo tiene un único centro de trabajo (ver armarDatosInforme79DesdeBd): la
  // participación ya agregada en `datos.participacion` aplica a ese centro.
  const participacion: EntradaParticipacionCentro[] = datos.centros.map((c) => ({
    nombreCentro: c.nombre,
    asignados: datos.participacion.asignados,
    completados: datos.participacion.completados,
  }));

  const { zip, manifiesto } = await armarExpediente({
    datos,
    pdfInforme: pdf,
    politica,
    acusesPolitica,
    participacion,
    capacitacion,
    generadoEl: new Date().toISOString(),
  });
  const sha256 = createHash('sha256').update(zip).digest('hex');

  const rutaArchivo = `informes/${companyId}/${cycleId}/expediente-${Date.now()}.zip`;
  const { error: errorSubida } = await supabase.storage
    .from('informes')
    .upload(rutaArchivo, zip, { contentType: 'application/zip' });
  if (errorSubida) return { ok: false, error: 'No se pudo subir el expediente' };

  const { data: reporte, error: errorInsert } = await supabase
    .from('compliance_reports')
    .insert({
      company_id: companyId,
      cycle_id: cycleId,
      report_type: 'expediente_zip',
      storage_path: rutaArchivo,
      sha256,
    })
    .select('id')
    .single();
  if (errorInsert || !reporte) return { ok: false, error: 'No se pudo registrar el expediente' };

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'expediente_generado',
    'compliance_reports',
    reporte.id,
    { cycleId, sha256, politicaPublicada: manifiesto.politicaPublicada },
  );

  revalidatePath(`/panel/${companyId}/ciclos/${cycleId}/informes`);
  return { ok: true, reporteId: reporte.id };
}
