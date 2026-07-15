// Purga física de una organización en baja (spec §2.6, decisiones selladas 4 y 7).
// MANUAL, nunca desde la UI. Orden inviolable:
//
//   1. Verificar: status='pending_deletion', plazo de retención VENCIDO (90 días) y los
//      4 avisos de retención (días 1/30/60/85) en platform_audit_log. Falta algo → ABORTA
//      (la purga solo es defendible si se avisó).
//   2. Generar el ACTA (evento `empresa_purgada` con INVENTARIO: conteos por entidad +
//      huellas sha256 de expedientes/informes/constancias — huellas, JAMÁS contenido).
//   3. VERIFICAR la escritura del acta (re-lectura por id). Sin acta escrita NO HAY
//      PURGA: si falla, aborta sin tocar nada.
//   4. Solo entonces: DELETE del tenant completo (incluido su audit_log: la evidencia es
//      del cliente y ya la exportó; conservarla tras la baja contradice la minimización
//      LFPDPPP) + borrado de sus objetos de Storage. El acta sobrevive en
//      platform_audit_log (company_id sin FK a propósito).
//
// El DELETE requiere conexión DIRECTA a Postgres (SUPABASE_DB_URL) con
// session_replication_role = replica: las tablas de evidencia son append-only por
// trigger (rechazan DELETE incluso al dueño) — correcto en vida del tenant; la purga
// LFPDPPP es la única excepción y vive solo aquí.
//
// Uso: node scripts/purgar-empresa.mjs <company_id>
// Doble confirmación interactiva: teclear el RFC (o la razón social) y luego PURGAR.
// Protegido contra targets no locales salvo PURGA_ALLOW=1 (patrón demo:seed).

/* eslint-disable no-console -- CLI operativa: imprime conteos y huellas, jamás contenido
   de respuestas o resultados (regla 9 aplica a logs de la aplicación). */

import { createInterface } from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { armarActaPurga, avisosCompletos, plazoCumplido } from './acta-purga.mjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const RETENCION_DIAS = 90;

if (!SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}
const pareceLocal = /127\.0\.0\.1|localhost/.test(SUPABASE_URL);
if (!pareceLocal && process.env.PURGA_ALLOW !== '1') {
  console.error(
    `NEXT_PUBLIC_SUPABASE_URL (${SUPABASE_URL}) no luce local.\n` +
      'Purgar en producción es un acto deliberado e irreversible: define PURGA_ALLOW=1 explícitamente.',
  );
  process.exit(1);
}

const companyId = process.argv[2];
if (!companyId) {
  console.error('Uso: node scripts/purgar-empresa.mjs <company_id>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function abortar(mensaje) {
  console.error(`ABORTADO: ${mensaje}`);
  process.exit(1);
}

// ─── 1. Verificaciones (fail-closed) ─────────────────────────────────────────

const { data: empresa, error: errorEmpresa } = await supabase
  .from('companies')
  .select('id, legal_name, rfc, status, deletion_requested_at')
  .eq('id', companyId)
  .maybeSingle();
if (errorEmpresa) abortar(`No se pudo consultar la empresa: ${errorEmpresa.message}`);
if (!empresa) abortar('La empresa no existe.');
if (empresa.status !== 'pending_deletion') {
  abortar(`El estado es '${empresa.status}', no 'pending_deletion': la purga no procede.`);
}
if (!empresa.deletion_requested_at) abortar('Sin deletion_requested_at: estado inconsistente.');
if (!plazoCumplido(empresa.deletion_requested_at, Date.now(), RETENCION_DIAS)) {
  abortar(
    `El plazo de retención de ${RETENCION_DIAS} días (desde ${empresa.deletion_requested_at}) aún no vence.`,
  );
}

const { data: filasAvisos, error: errorAvisos } = await supabase
  .from('platform_audit_log')
  .select('details, created_at')
  .eq('event_type', 'aviso_retencion_enviado')
  .eq('company_id', companyId);
if (errorAvisos) abortar(`No se pudo consultar los avisos: ${errorAvisos.message}`);
const avisos = (filasAvisos ?? []).map((f) => ({
  hito: Number(f.details?.hito),
  enviado_el: f.created_at,
}));
if (!avisosCompletos(avisos)) {
  abortar(
    `Faltan avisos de retención (encontrados: ${avisos.map((a) => a.hito).join(', ') || 'ninguno'}; se exigen 1, 30, 60 y 85). La purga solo es defendible si se avisó.`,
  );
}

// ─── 2. Inventario y huellas ─────────────────────────────────────────────────

async function contar(tabla) {
  const { count, error } = await supabase
    .from(tabla)
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);
  if (error) abortar(`No se pudo contar ${tabla}: ${error.message}`);
  return count ?? 0;
}

const inventario = {
  centros: await contar('work_centers'),
  empleados: await contar('employees'),
  ciclos: await contar('compliance_cycles'),
  asignaciones: await contar('questionnaire_assignments'),
  respuestas: await contar('responses'),
  resultados: (await contar('risk_results')) + (await contar('gr1_results')),
  informes: await contar('compliance_reports'),
  quejas: await contar('complaints'),
  eventos_ats: await contar('traumatic_events'),
  constancias_difusion: await contar('dissemination_records'),
  programas: await contar('intervention_programs'),
  borradores_ia: await contar('ai_drafts'),
};

const { data: reportes } = await supabase
  .from('compliance_reports')
  .select('report_type, sha256, storage_path, compliance_cycles (name)')
  .eq('company_id', companyId);
const nombreCiclo = (r) => r.compliance_cycles?.name ?? 'sin ciclo';
const huellas = {
  expedientes: (reportes ?? [])
    .filter((r) => r.report_type === 'expediente_zip')
    .map((r) => ({ ciclo: nombreCiclo(r), sha256: r.sha256 })),
  informes: (reportes ?? [])
    .filter((r) => r.report_type !== 'expediente_zip')
    .map((r) => ({ ciclo: nombreCiclo(r), sha256: r.sha256 })),
  constancias: [],
};
const { data: constancias } = await supabase
  .from('dissemination_records')
  .select('version, sha256, compliance_cycles (name)')
  .eq('company_id', companyId);
huellas.constancias = (constancias ?? []).map((c) => ({
  ciclo: c.compliance_cycles?.name ?? 'sin ciclo',
  version: c.version,
  sha256: c.sha256,
}));

let acta;
try {
  acta = armarActaPurga({
    empresa: {
      legal_name: empresa.legal_name,
      rfc: empresa.rfc,
      deletion_requested_at: empresa.deletion_requested_at,
    },
    avisos,
    inventario,
    huellas,
  });
} catch (e) {
  abortar(e.message);
}

// ─── Doble confirmación tecleando el RFC ─────────────────────────────────────

console.log('\n════════ PURGA FÍSICA — IRREVERSIBLE ════════');
console.log(`Empresa: ${empresa.legal_name} (${empresa.rfc ?? 'sin RFC'})`);
console.log(`Baja solicitada: ${empresa.deletion_requested_at}`);
console.log('Inventario a purgar:', JSON.stringify(inventario));
console.log(
  `Huellas en el acta: ${acta.huellas.expedientes.length} expedientes, ${acta.huellas.informes.length} informes, ${acta.huellas.constancias.length} constancias.`,
);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const claveEsperada = empresa.rfc ?? empresa.legal_name;
const tecleado = await rl.question(
  `\nConfirmación 1/2 — teclea el ${empresa.rfc ? 'RFC' : 'nombre exacto (sin RFC registrado)'} de la empresa: `,
);
if (tecleado.trim() !== claveEsperada) {
  rl.close();
  abortar('La confirmación no coincide.');
}
const orden = await rl.question('Confirmación 2/2 — escribe PURGAR para ejecutar: ');
rl.close();
if (orden.trim() !== 'PURGAR') abortar('Confirmación cancelada.');

// ─── 3. Acta ANTES de borrar + verificación de su escritura ──────────────────

const { data: actaFila, error: errorActa } = await supabase
  .from('platform_audit_log')
  .insert({
    operator_id: null, // actor sistema: el script; quién lo corrió queda en la operación
    event_type: 'empresa_purgada',
    company_id: companyId,
    entity: 'companies',
    entity_id: companyId,
    details: acta,
  })
  .select('id')
  .single();
if (errorActa || !actaFila) {
  abortar(
    `No se pudo escribir el acta (${errorActa?.message ?? 'sin detalle'}): SIN ACTA NO HAY PURGA.`,
  );
}
const { data: actaLeida } = await supabase
  .from('platform_audit_log')
  .select('id, event_type')
  .eq('id', actaFila.id)
  .maybeSingle();
if (!actaLeida || actaLeida.event_type !== 'empresa_purgada') {
  abortar('El acta no se pudo re-leer tras escribirla: SIN ACTA VERIFICADA NO HAY PURGA.');
}
console.log(`Acta escrita y verificada (platform_audit_log id ${actaFila.id}).`);

// ─── 4. Storage y DELETE físico ──────────────────────────────────────────────

// Rutas de objetos ANTES de borrar las filas que las conocen.
const rutasPorBucket = { informes: [], politicas: [], capacitacion: [], evidencias: [], logos: [] };
for (const r of reportes ?? []) if (r.storage_path) rutasPorBucket.informes.push(r.storage_path);
const { data: politicas } = await supabase
  .from('policies')
  .select('storage_path')
  .eq('company_id', companyId);
for (const p of politicas ?? []) if (p.storage_path) rutasPorBucket.politicas.push(p.storage_path);
const { data: cursos } = await supabase
  .from('training_contents')
  .select('storage_path')
  .eq('company_id', companyId);
for (const c of cursos ?? []) if (c.storage_path) rutasPorBucket.capacitacion.push(c.storage_path);
const { data: accionesEv } = await supabase
  .from('action_items')
  .select('evidence_path')
  .eq('company_id', companyId)
  .not('evidence_path', 'is', null);
for (const a of accionesEv ?? []) rutasPorBucket.evidencias.push(a.evidence_path);
const { data: settings } = await supabase
  .from('company_settings')
  .select('logo_path')
  .eq('company_id', companyId)
  .maybeSingle();
if (settings?.logo_path) rutasPorBucket.logos.push(settings.logo_path);

// DELETE físico con conexión directa: session_replication_role = replica desactiva los
// triggers append-only (y las FKs) SOLO en esta transacción de purga.
const cliente = new pg.Client({ connectionString: DB_URL });
await cliente.connect();
try {
  await cliente.query('begin');
  await cliente.query(`set local session_replication_role = replica`);
  const { rows: tablas } = await cliente.query(`
    select c.relname as tabla
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname <> 'platform_audit_log' -- el acta SOBREVIVE a la purga
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'company_id' and not a.attisdropped
      )
  `);
  for (const { tabla } of tablas) {
    await cliente.query(`delete from ${tabla} where company_id = $1`, [companyId]);
  }
  await cliente.query('delete from companies where id = $1', [companyId]);
  await cliente.query('commit');
} catch (e) {
  await cliente.query('rollback');
  abortar(`Fallo el DELETE físico (todo revertido): ${e.message}`);
} finally {
  await cliente.end();
}
console.log('Filas del tenant eliminadas (incluido su audit_log).');

for (const [bucket, rutas] of Object.entries(rutasPorBucket)) {
  if (rutas.length === 0) continue;
  const { error } = await supabase.storage.from(bucket).remove(rutas);
  if (error) {
    console.error(
      `OJO: no se pudieron borrar ${rutas.length} objetos de '${bucket}': ${error.message}`,
    );
  } else {
    console.log(`Storage '${bucket}': ${rutas.length} objetos eliminados.`);
  }
}

console.log(
  `\nPurga completada. El acta con inventario sobrevive en platform_audit_log (id ${actaFila.id}).`,
);
