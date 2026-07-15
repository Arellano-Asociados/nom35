// Seed de DEMO COMERCIAL (Fase 7): el guion vivo de la demo de Constata. Cada pantalla del
// producto tiene algo interesante que mostrar. Idempotente por CLAVE NATURAL (razón social,
// email, folio, título…): volver a correrlo no duplica nada.
//
// Requisitos: Supabase local arriba + migraciones aplicadas. El motor se compila antes
// (`pnpm seed:demo` encadena el build de @nom35/motor-nom035, igual que demo:seed).
//
// SEGURIDAD: rechaza correr contra un proyecto que no luzca local salvo DEMO_ALLOW=1. Este
// seed JAMÁS debe tocar producción (crea cuentas con contraseñas conocidas y datos ficticios).
//
// Contenido:
//   · Org 1 "Constata Demo, S.A. de C.V." (activa, completa): 3 centros de los tres tamaños
//     normativos (>50 GR-III, 16–50 GR-II, ≤15 solo GR-I), 60+ empleados con nombres
//     mexicanos, 1 ciclo COMPLETADO con los 5 niveles del semáforo, 1 ciclo EN CURSO (~40%),
//     política con acuses parciales, capacitación, evento ATS con canalización, programa de
//     intervención con acciones en varios estados, 2 quejas en estados distintos, difusión
//     publicada, cuestionario personalizado, y 2 borradores de IA (uno generado, uno adoptado).
//   · Org 2 "Aislamiento Demo, S. de R.L." (para demostrar el aislamiento entre empresas).

/* eslint-disable no-console -- CLI de seed: mensajes operativos, no datos de trabajadores. */

import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  calificarCuestionario,
  evaluarGR1,
  GR2,
  GR3,
  MOTOR_NOM035_VERSION,
} from '../packages/motor-nom035/dist/index.js';

// ─── Config y rieles de seguridad ────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY (lo imprime `pnpm exec supabase start`).');
  process.exit(1);
}
const pareceLocal = /127\.0\.0\.1|localhost/.test(SUPABASE_URL);
if (!pareceLocal && process.env.DEMO_ALLOW !== '1') {
  console.error(
    `NEXT_PUBLIC_SUPABASE_URL (${SUPABASE_URL}) no luce local. Este seed es SOLO para demo/desarrollo.\n` +
      'Crea cuentas con contraseñas conocidas: jamás debe correr contra producción. Define DEMO_ALLOW=1 si de verdad lo quieres.',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = 'ConstataDemo!2026';

// ─── Helpers de idempotencia ─────────────────────────────────────────────────

async function buscarUno(tabla, filtro, columnas = 'id') {
  let q = supabase.from(tabla).select(columnas);
  for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`${tabla} (buscar ${JSON.stringify(filtro)}): ${error.message}`);
  return data;
}
async function crearUno(tabla, valores, columnas = 'id') {
  const { data, error } = await supabase.from(tabla).insert(valores).select(columnas).single();
  if (error) throw new Error(`${tabla} (crear): ${error.message}`);
  return data;
}
async function encontrarOCrear(tabla, filtro, extra = {}, columnas = 'id') {
  const existente = await buscarUno(tabla, filtro, columnas);
  if (existente) return existente;
  return crearUno(tabla, { ...filtro, ...extra }, columnas);
}
async function contarFilas(tabla, filtro) {
  let q = supabase.from(tabla).select('id', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v);
  const { count, error } = await q;
  if (error) throw new Error(`${tabla} (contar): ${error.message}`);
  return count ?? 0;
}
async function encontrarOCrearUsuario(email, password) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  const existente = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existente) return existente.id;
  const { data: creado, error: e2 } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (e2) throw new Error(`createUser(${email}): ${e2.message}`);
  return creado.user.id;
}
const hashDeToken = (t) => createHash('sha256').update(t).digest('hex');
const generarToken = () => randomBytes(32).toString('base64url');

/** Sello canónico (claves ordenadas → sha256), espejo de lib/cuestionarios-sello.ts. */
function ordenarClaves(v) {
  if (Array.isArray(v)) return v.map(ordenarClaves);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, ordenarClaves(v[k])]),
    );
  }
  return v;
}
function selloCanonico(valor) {
  const json = JSON.stringify(ordenarClaves(valor));
  return { json, sha256: createHash('sha256').update(json).digest('hex') };
}

// ─── Helpers del motor (construir respuestas para un nivel objetivo) ─────────

function distribuirPuntaje(total, cantidad) {
  const acotado = Math.max(0, Math.min(total, cantidad * 4));
  const base = Math.floor(acotado / cantidad);
  const resto = acotado - base * cantidad;
  return Array.from({ length: cantidad }, (_, i) => (i < resto ? base + 1 : base));
}
const OPCIONES_LIKERT = ['siempre', 'casi_siempre', 'algunas_veces', 'casi_nunca', 'nunca'];
const respuestaDesdeScore = (score, grupo) => OPCIONES_LIKERT[grupo === 'A' ? score : 4 - score];

function construirRespuestasLikert(guia, filtros, cfinalObjetivo) {
  const noAplican = new Set([
    ...(filtros.atiendeClientes ? [] : guia.itemsCondicionales.atiendeClientes),
    ...(filtros.supervisaPersonal ? [] : guia.itemsCondicionales.supervisaPersonal),
  ]);
  const items = [];
  for (let i = 1; i <= guia.totalItems; i++) if (!noAplican.has(i)) items.push(i);
  const puntajes = distribuirPuntaje(cfinalObjetivo, items.length);
  const respuestas = {};
  const filas = [];
  items.forEach((item, idx) => {
    const r = respuestaDesdeScore(puntajes[idx], guia.grupoDeItem[item]);
    respuestas[item] = r;
    filas.push({ item_number: item, answer: r });
  });
  return {
    entrada: {
      respuestas,
      atiendeClientes: filtros.atiendeClientes,
      supervisaPersonal: filtros.supervisaPersonal,
    },
    filas,
  };
}
function construirRespuestasGR1(perfil) {
  const filas = [];
  const entrada = { seccionI: perfil.seccionI };
  filas.push(
    ...perfil.seccionI.map((s, i) => ({
      section: 'I',
      item_number: i + 1,
      answer: s ? 'si' : 'no',
    })),
  );
  for (const sec of ['seccionII', 'seccionIII', 'seccionIV']) {
    if (perfil[sec]) {
      entrada[sec] = perfil[sec];
      const nombre = sec.replace('seccion', '');
      filas.push(
        ...perfil[sec].map((s, i) => ({
          section: nombre,
          item_number: i + 1,
          answer: s ? 'si' : 'no',
        })),
      );
    }
  }
  return { entrada, filas };
}
const OBJETIVO_CFINAL_GR3 = { nulo: 25, bajo: 62, medio: 87, alto: 120, muy_alto: 200 };
const OBJETIVO_CFINAL_GR2 = { nulo: 10, bajo: 32, medio: 57, alto: 80, muy_alto: 130 };
const NIVELES = ['nulo', 'bajo', 'medio', 'alto', 'muy_alto'];

const GR1_SIN_EVENTO = { seccionI: [false, false, false, false, false, false] };
const GR1_CON_EVENTO_CANALIZADO = {
  seccionI: [true, false, false, false, false, false],
  seccionII: [true, false],
  seccionIII: [false, false, false, false, false, false, false],
  seccionIV: [false, false, false, false, false],
};

// ─── Nombres mexicanos realistas ─────────────────────────────────────────────

const NOMBRES = [
  'María',
  'José',
  'Guadalupe',
  'Juan',
  'Francisco',
  'Alejandra',
  'Miguel',
  'Verónica',
  'Ricardo',
  'Fernanda',
  'Roberto',
  'Adriana',
  'Luis',
  'Gabriela',
  'Carlos',
  'Mariana',
  'Jorge',
  'Patricia',
  'Eduardo',
  'Claudia',
  'Sergio',
  'Rosa',
  'Héctor',
  'Diana',
  'Raúl',
  'Leticia',
  'Arturo',
  'Norma',
  'Manuel',
  'Silvia',
  'Alberto',
  'Karla',
  'Enrique',
  'Beatriz',
  'Óscar',
  'Elena',
  'Javier',
  'Lorena',
  'Antonio',
  'Cecilia',
];
const APELLIDOS = [
  'Hernández',
  'García',
  'Martínez',
  'López',
  'González',
  'Rodríguez',
  'Pérez',
  'Sánchez',
  'Ramírez',
  'Cruz',
  'Flores',
  'Gómez',
  'Morales',
  'Vázquez',
  'Reyes',
  'Jiménez',
  'Torres',
  'Díaz',
  'Mendoza',
  'Aguilar',
  'Ortiz',
  'Castillo',
  'Romero',
  'Álvarez',
  'Ruiz',
  'Chávez',
  'Domínguez',
  'Guerrero',
  'Medina',
  'Rojas',
];
const AREAS = ['Ventas', 'Producción', 'Administración', 'Logística', 'Atención a clientes'];

function nombreMexicano(indiceGlobal) {
  const n = NOMBRES[indiceGlobal % NOMBRES.length];
  const a1 = APELLIDOS[(indiceGlobal * 7) % APELLIDOS.length];
  const a2 = APELLIDOS[(indiceGlobal * 13 + 3) % APELLIDOS.length];
  return `${n} ${a1} ${a2}`;
}

let contadorGlobalEmpleados = 0;

// ─── Pasos base (empresa, centro, ciclo, empleado, asignación, resultados) ────

async function obtenerQuestionnaireIds() {
  const { data, error } = await supabase.from('questionnaires').select('id, code');
  if (error) throw new Error(`questionnaires: ${error.message}`);
  const mapa = new Map(data.map((f) => [f.code, f.id]));
  for (const c of ['GR-I', 'GR-II', 'GR-III']) {
    if (!mapa.has(c))
      throw new Error(`Falta el cuestionario ${c}: ¿corriste \`supabase db reset\`?`);
  }
  return mapa;
}
async function crearCentro(companyId, nombre, headcount) {
  return encontrarOCrear(
    'work_centers',
    { company_id: companyId, name: nombre },
    { headcount },
    'id, nom_category, name',
  );
}
async function crearCiclo(companyId, workCenterId, nombre, fechaInicioIso, cerrado) {
  const ciclo = await encontrarOCrear(
    'compliance_cycles',
    { company_id: companyId, work_center_id: workCenterId, name: nombre },
    {
      date_start: fechaInicioIso,
      date_end: cerrado ? new Date().toISOString().slice(0, 10) : null,
      evaluator_name: 'Dra. Consultora Demo',
      evaluator_license: 'CED-DEMO-001',
    },
    'id',
  );
  return ciclo.id;
}
async function crearEmpleado(companyId, workCenterId, perfil) {
  return encontrarOCrear(
    'employees',
    { company_id: companyId, email: perfil.email },
    {
      work_center_id: workCenterId,
      full_name: perfil.nombre,
      area: perfil.area,
      attends_customers: perfil.atiendeClientes,
      supervises_others: perfil.supervisaPersonal,
    },
  );
}
async function crearAsignacion(companyId, cycleId, employeeId, questionnaireId) {
  const existente = await buscarUno(
    'questionnaire_assignments',
    { cycle_id: cycleId, employee_id: employeeId, questionnaire_id: questionnaireId },
    'id, token_hash, completed_at',
  );
  if (existente) return { id: existente.id, completado: existente.completed_at !== null };
  const token = generarToken();
  const creada = await crearUno('questionnaire_assignments', {
    company_id: companyId,
    cycle_id: cycleId,
    employee_id: employeeId,
    questionnaire_id: questionnaireId,
    token_hash: hashDeToken(token),
    expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return { id: creada.id, completado: false, token };
}
async function asegurarConsentimiento(companyId, assignmentId, employeeId) {
  await encontrarOCrear(
    'consents',
    { assignment_id: assignmentId },
    { company_id: companyId, employee_id: employeeId, privacy_text_version: 'v1', ip: '10.0.0.5' },
  );
}
async function marcarCompletada(assignmentId) {
  await supabase
    .from('questionnaire_assignments')
    .update({
      completed_at: new Date().toISOString(),
      filters_captured_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
    .is('completed_at', null);
}
async function sembrarResultadoLikert(ctx) {
  if ((await contarFilas('responses', { assignment_id: ctx.assignmentId })) > 0) return;
  const objetivo = (ctx.guia === 'GR-III' ? OBJETIVO_CFINAL_GR3 : OBJETIVO_CFINAL_GR2)[ctx.nivel];
  const { entrada, filas } = construirRespuestasLikert(ctx.guiaDef, ctx.filtros, objetivo);
  const resultado = calificarCuestionario(entrada, ctx.guiaDef);
  const { error } = await supabase.from('responses').insert(
    filas.map((f) => ({
      company_id: ctx.companyId,
      assignment_id: ctx.assignmentId,
      section: null,
      item_number: f.item_number,
      answer: f.answer,
    })),
  );
  if (error) throw new Error(`responses (${ctx.guia}): ${error.message}`);
  if ((await contarFilas('risk_results', { assignment_id: ctx.assignmentId })) === 0) {
    const { error: e2 } = await supabase.from('risk_results').insert({
      company_id: ctx.companyId,
      assignment_id: ctx.assignmentId,
      employee_id: ctx.employeeId,
      cycle_id: ctx.cycleId,
      questionnaire_id: ctx.questionnaireId,
      cfinal: resultado.cfinal,
      nivel_final: resultado.nivelFinal,
      categorias: resultado.categorias,
      dominios: resultado.dominios,
      engine_version: MOTOR_NOM035_VERSION,
    });
    if (e2) throw new Error(`risk_results: ${e2.message}`);
  }
}
async function sembrarResultadoGR1(ctx) {
  if ((await contarFilas('responses', { assignment_id: ctx.assignmentId })) > 0) return null;
  const { entrada, filas } = construirRespuestasGR1(ctx.perfil);
  const resultado = evaluarGR1(entrada);
  const { error } = await supabase.from('responses').insert(
    filas.map((f) => ({
      company_id: ctx.companyId,
      assignment_id: ctx.assignmentId,
      section: f.section,
      item_number: f.item_number,
      answer: f.answer,
    })),
  );
  if (error) throw new Error(`responses (GR-I): ${error.message}`);
  if ((await contarFilas('gr1_results', { assignment_id: ctx.assignmentId })) === 0) {
    const creado = await crearUno('gr1_results', {
      company_id: ctx.companyId,
      assignment_id: ctx.assignmentId,
      employee_id: ctx.employeeId,
      cycle_id: ctx.cycleId,
      presento_acontecimiento: resultado.presentoAcontecimiento,
      requiere_valoracion: resultado.requiereValoracionClinica,
      secciones_disparadas: resultado.seccionesQueDisparan,
    });
    return creado.id;
  }
  return null;
}

/**
 * Siembra un centro con su ciclo. `nivelesPorEmpleado` fija el nivel de cada empleado
 * completado (para pintar el semáforo a voluntad). `porcentajeCompletado` deja el resto en
 * curso. `guiaLikert` null = solo GR-I (centro ≤15).
 */
async function sembrarCentro(opts) {
  const {
    companyId,
    questionnaireIds,
    nombreCentro,
    headcount,
    guiaLikert,
    guiaDef,
    nivelesPorEmpleado,
    prefijoEmail,
    cicloNombre,
    fechaInicioIso,
    cerrado,
    porcentajeCompletado = 1,
  } = opts;
  const centro = await crearCentro(companyId, nombreCentro, headcount);
  const cycleId = await crearCiclo(companyId, centro.id, cicloNombre, fechaInicioIso, cerrado);
  const total = nivelesPorEmpleado.length;
  const aCompletar = Math.round(total * porcentajeCompletado);
  const empleados = [];
  let gr1CanalizadoHecho = false;

  for (let i = 0; i < total; i++) {
    const perfil = {
      nombre: nombreMexicano(contadorGlobalEmpleados++),
      email: `${prefijoEmail}-emp-${i + 1}@constata-demo.mx`,
      area: AREAS[i % AREAS.length],
      atiendeClientes: i % 3 === 0,
      supervisaPersonal: i % 5 === 0,
      nivel: nivelesPorEmpleado[i],
    };
    const empleado = await crearEmpleado(companyId, centro.id, perfil);
    empleados.push({ ...perfil, id: empleado.id });

    const asgGR1 = await crearAsignacion(
      companyId,
      cycleId,
      empleado.id,
      questionnaireIds.get('GR-I'),
    );
    const asgLikert = guiaLikert
      ? await crearAsignacion(companyId, cycleId, empleado.id, questionnaireIds.get(guiaLikert))
      : null;

    if (i >= aCompletar) continue; // en curso: sin responder

    await asegurarConsentimiento(companyId, asgGR1.id, empleado.id);
    if (asgLikert) await asegurarConsentimiento(companyId, asgLikert.id, empleado.id);

    // Un caso GR-I con acontecimiento canalizado por centro (para la vista GR-I del RD).
    const perfilGR1 = !gr1CanalizadoHecho && i === 1 ? GR1_CON_EVENTO_CANALIZADO : GR1_SIN_EVENTO;
    const gr1Id = await sembrarResultadoGR1({
      companyId,
      employeeId: empleado.id,
      cycleId,
      assignmentId: asgGR1.id,
      perfil: perfilGR1,
    });
    if (perfilGR1 === GR1_CON_EVENTO_CANALIZADO && gr1Id) {
      await supabase
        .from('gr1_results')
        .update({
          canalizacion_estatus: 'canalizado',
          canalizacion_fecha: new Date().toISOString().slice(0, 10),
        })
        .eq('id', gr1Id);
      gr1CanalizadoHecho = true;
    }
    await marcarCompletada(asgGR1.id);

    if (asgLikert) {
      await sembrarResultadoLikert({
        companyId,
        employeeId: empleado.id,
        cycleId,
        questionnaireId: questionnaireIds.get(guiaLikert),
        assignmentId: asgLikert.id,
        guia: guiaLikert,
        guiaDef,
        filtros: {
          atiendeClientes: perfil.atiendeClientes,
          supervisaPersonal: perfil.supervisaPersonal,
        },
        nivel: perfil.nivel,
      });
      await marcarCompletada(asgLikert.id);
    }
  }
  console.log(
    `  ${nombreCentro} (${centro.nom_category}): ${total} empleados, ${aCompletar} completados`,
  );
  return { cycleId, workCenterId: centro.id, centro, empleados };
}

// ─── Módulos ricos de la demo ────────────────────────────────────────────────

async function sembrarPolitica(companyId, empleados) {
  const ruta = `${companyId}/politica-prevencion-demo.txt`;
  const texto = `Política de Prevención de Riesgos Psicosociales — Constata Demo, S.A. de C.V.\n(Documento de demostración; NO usar en un centro de trabajo real.)`;
  await supabase.storage
    .from('politicas')
    .upload(ruta, Buffer.from(texto, 'utf-8'), { contentType: 'text/plain', upsert: true });
  const politica = await encontrarOCrear(
    'policies',
    {
      company_id: companyId,
      title: 'Política de Prevención de Riesgos Psicosociales',
      version: 'v1',
    },
    { storage_path: ruta },
  );
  const conAcuse = empleados.filter((_e, i) => i % 2 === 0);
  for (const e of conAcuse) {
    await encontrarOCrear(
      'policy_acknowledgments',
      { policy_id: politica.id, employee_id: e.id },
      { company_id: companyId },
    );
  }
  console.log(`  Política publicada con ${conAcuse.length}/${empleados.length} acuses`);
}

async function sembrarProgramaConAcciones(companyId, cycleId, adminId) {
  const programa = await encontrarOCrear(
    'intervention_programs',
    { company_id: companyId, cycle_id: cycleId },
    {
      scope_areas: 'Centro Corporativo CDMX — áreas de Producción y Ventas',
      responsible: 'Recursos Humanos',
      created_by: adminId,
    },
  );
  const acciones = [
    {
      description: 'Revisar y equilibrar las cargas de trabajo (Factores propios de la actividad)',
      origin_level: 'muy_alto',
      action_level: 'primer_nivel',
      status: 'completada',
      completado: true,
    },
    {
      description: 'Capacitar a mandos medios en liderazgo y comunicación (Liderazgo y relaciones)',
      origin_level: 'alto',
      action_level: 'primer_nivel',
      status: 'en_progreso',
      completado: false,
    },
    {
      description: 'Establecer mecanismos de reconocimiento del desempeño (Entorno organizacional)',
      origin_level: 'medio',
      action_level: 'segundo_nivel',
      status: 'pendiente',
      completado: false,
    },
    {
      description: 'Canalizar a atención clínica a quien lo requiera (tercer nivel)',
      origin_level: 'alto',
      action_level: 'tercer_nivel',
      status: 'pendiente',
      completado: false,
    },
  ];
  for (const a of acciones) {
    const existente = await buscarUno(
      'action_items',
      { company_id: companyId, cycle_id: cycleId, description: a.description },
      'id',
    );
    if (existente) continue;
    await crearUno('action_items', {
      company_id: companyId,
      cycle_id: cycleId,
      program_id: programa.id,
      description: a.description,
      origin_level: a.origin_level,
      responsible: 'Recursos Humanos',
      action_level: a.action_level,
      status: a.status,
      completed_at: a.completado ? new Date().toISOString() : null,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
  }
  console.log(`  Programa de intervención con ${acciones.length} acciones (varios estados)`);
}

async function sembrarBuzon(companyId, adminId) {
  const box = await buscarUno('complaint_boxes', { company_id: companyId }, 'company_id');
  if (!box) {
    const token = generarToken();
    await crearUno(
      'complaint_boxes',
      { company_id: companyId, token, token_hash: hashDeToken(token) },
      'company_id',
    );
  }
  const quejas = [
    {
      folio: 'QJ-DEMO-0001',
      clave: 'CLAVE-A',
      category: 'violencia_laboral',
      body: 'Reporte de demostración: trato hostil reiterado de un supervisor.',
      estadoFinal: 'en_revision',
    },
    {
      folio: 'QJ-DEMO-0002',
      clave: 'CLAVE-B',
      category: 'practicas_opuestas_eof',
      body: 'Reporte de demostración: falta de reconocimiento y jornadas excesivas.',
      estadoFinal: 'cerrada',
    },
  ];
  for (const q of quejas) {
    let queja = await buscarUno(
      'complaints',
      { company_id: companyId, folio: q.folio },
      'id, status',
    );
    if (!queja) {
      queja = await crearUno(
        'complaints',
        {
          company_id: companyId,
          folio: q.folio,
          folio_key_hash: hashDeToken(q.clave),
          category: q.category,
          body: q.body,
          is_identified: false,
        },
        'id, status',
      );
    }
    // Avanza el estado con eventos (recibida → en_revision → [cerrada]).
    const cadena = q.estadoFinal === 'cerrada' ? ['en_revision', 'cerrada'] : ['en_revision'];
    let desde = queja.status ?? 'recibida';
    for (const hacia of cadena) {
      if (desde === hacia) continue;
      const yaExiste = await buscarUno(
        'complaint_events',
        { company_id: companyId, complaint_id: queja.id, to_status: hacia },
        'id',
      );
      if (!yaExiste) {
        await crearUno('complaint_events', {
          company_id: companyId,
          complaint_id: queja.id,
          from_status: desde,
          to_status: hacia,
          note: `Seguimiento de demostración: ${desde} → ${hacia}.`,
          actor_user_id: adminId,
        });
        await supabase.from('complaints').update({ status: hacia }).eq('id', queja.id);
      }
      desde = hacia;
    }
  }
  console.log(`  Buzón de quejas: 2 quejas (una en revisión, una cerrada)`);
}

async function sembrarEventoAts(companyId, workCenterId, questionnaireIds, adminId) {
  const evento = await encontrarOCrear(
    'traumatic_events',
    {
      company_id: companyId,
      work_center_id: workCenterId,
      description: 'Asalto a mano armada en el turno vespertino (demostración).',
    },
    {
      occurred_on: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      reported_by: adminId,
    },
  );
  // Ciclo ATS marcado + GR-I a 2 expuestos, uno con canalización.
  const cicloAts = await encontrarOCrear(
    'compliance_cycles',
    {
      company_id: companyId,
      work_center_id: workCenterId,
      name: 'Acontecimiento traumático — expuestos',
    },
    {
      date_start: new Date().toISOString().slice(0, 10),
      evaluator_name: 'Dra. Consultora Demo',
      evaluator_license: 'CED-DEMO-001',
      traumatic_event_id: evento.id,
    },
  );
  const { data: expuestos } = await supabase
    .from('employees')
    .select('id')
    .eq('company_id', companyId)
    .eq('work_center_id', workCenterId)
    .limit(2);
  for (const [i, emp] of (expuestos ?? []).entries()) {
    const asg = await crearAsignacion(companyId, cicloAts.id, emp.id, questionnaireIds.get('GR-I'));
    await asegurarConsentimiento(companyId, asg.id, emp.id);
    const gr1Id = await sembrarResultadoGR1({
      companyId,
      employeeId: emp.id,
      cycleId: cicloAts.id,
      assignmentId: asg.id,
      perfil: i === 0 ? GR1_CON_EVENTO_CANALIZADO : GR1_SIN_EVENTO,
    });
    if (i === 0 && gr1Id) {
      await supabase
        .from('gr1_results')
        .update({
          canalizacion_estatus: 'canalizado',
          canalizacion_fecha: new Date().toISOString().slice(0, 10),
        })
        .eq('id', gr1Id);
    }
    await marcarCompletada(asg.id);
  }
  console.log(`  Evento ATS con ${(expuestos ?? []).length} expuestos evaluados (uno canalizado)`);
}

async function sembrarCuestionarioPersonalizado(companyId) {
  const definicion = {
    secciones: [
      {
        id: 'sec-1',
        titulo: 'Clima del equipo',
        preguntas: [
          { id: 'p1', texto: '¿Te sientes escuchado por tu líder de equipo?', tipo: 'likert5' },
          {
            id: 'p2',
            texto: '¿Recomendarías esta empresa como un buen lugar para trabajar?',
            tipo: 'si_no',
          },
          { id: 'p3', texto: '¿Qué mejorarías del ambiente de trabajo?', tipo: 'abierta' },
        ],
      },
    ],
  };
  const { sha256 } = selloCanonico(definicion);
  const existente = await buscarUno(
    'custom_questionnaires',
    { company_id: companyId, title: 'Encuesta interna de clima (demo)' },
    'id, status',
  );
  if (!existente) {
    await crearUno('custom_questionnaires', {
      company_id: companyId,
      title: 'Encuesta interna de clima (demo)',
      status: 'publicado',
      definition: definicion,
      sha256,
      published_at: new Date().toISOString(),
    });
  }
  console.log(`  Cuestionario personalizado publicado`);
}

async function sembrarDifusion(companyId, cycleId, adminId) {
  const resumen = {
    parrafos: [
      'La mayoría del personal se ubica en niveles de riesgo bajo o nulo; se detectaron focos en carga de trabajo que el programa de intervención atiende.',
    ],
  };
  const { sha256 } = selloCanonico(resumen);
  await encontrarOCrear(
    'dissemination_records',
    { company_id: companyId, cycle_id: cycleId, version: 1 },
    { summary: resumen, sha256, published_by: adminId },
  );
  console.log(`  Constancia de difusión publicada`);
}

async function sembrarBorradoresIa(companyId, cycleId, adminId) {
  // Textos deterministas equivalentes a los del ProveedorSimulado (el seed no llama al proveedor).
  const insumo = {
    ciclo: { nombre: 'Ciclo 2026 — Corporativo CDMX' },
    participacion: { asignados: 35, completados: 30 },
  };
  const { sha256 } = selloCanonico(insumo);
  const textoResumen =
    '## Panorama general\nParticipación alta (30 de 35). El panorama global es de riesgo mayormente bajo, con focos en carga de trabajo.\n\n## Focos de atención\nEl dominio "Carga de trabajo" presenta nivel alto reportable en Producción.\n\n## Recomendación para la dirección\nPriorizar la revisión de cargas y el reconocimiento del desempeño.';

  // Uno GENERADO (sin adoptar) y uno ADOPTADO — idempotencia por (tipo, adoptado o no).
  const { count: sinAdoptar } = await supabase
    .from('ai_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('tipo', 'resumen_ejecutivo')
    .is('adopted_at', null);
  if ((sinAdoptar ?? 0) === 0) {
    await crearUno('ai_drafts', {
      company_id: companyId,
      cycle_id: cycleId,
      tipo: 'resumen_ejecutivo',
      texto: textoResumen,
      modelo: 'claude-haiku-4-5-demo',
      prompt_version: 'resumen_v1',
      insumo,
      insumo_sha256: sha256,
      generated_by: adminId,
    });
  }
  const { count } = await supabase
    .from('ai_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('tipo', 'resumen_ejecutivo')
    .not('adopted_at', 'is', null);
  if ((count ?? 0) === 0) {
    await crearUno('ai_drafts', {
      company_id: companyId,
      cycle_id: cycleId,
      tipo: 'resumen_ejecutivo',
      texto: textoResumen,
      modelo: 'claude-haiku-4-5-demo',
      prompt_version: 'resumen_v1',
      insumo,
      insumo_sha256: sha256,
      generated_by: adminId,
      adopted_by: adminId,
      adopted_at: new Date().toISOString(),
    });
  }
  console.log(`  Borradores de IA: 1 generado (sin adoptar) + 1 adoptado`);
}

async function activarFlagIa(companyId) {
  await supabase
    .from('feature_flags')
    .upsert(
      { company_id: companyId, flag: 'ia_asistida', enabled: true },
      { onConflict: 'company_id,flag' },
    );
}

async function sembrarCuenta(companyId, email, rol, esRd = false) {
  const userId = await encontrarOCrearUsuario(email, PASSWORD);
  await supabase
    .from('role_assignments')
    .upsert(
      { company_id: companyId, auth_user_id: userId, role: rol, is_designated_responsible: esRd },
      { onConflict: 'company_id,auth_user_id' },
    );
  return userId;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Sembrando la demo comercial contra ${SUPABASE_URL} …\n`);
  const qids = await obtenerQuestionnaireIds();

  // ═══ Org 1: Constata Demo (activa, completa) ═══
  const org1 = await encontrarOCrear(
    'companies',
    { legal_name: 'Constata Demo, S.A. de C.V.' },
    { rfc: 'CDE260715AB1', privacy_notice_version: 'v1', status: 'active' },
  );
  console.log(`Org 1: Constata Demo (${org1.id})`);
  const adminId = await sembrarCuenta(org1.id, 'admin@constata-demo.mx', 'admin_org');
  await sembrarCuenta(org1.id, 'rd@constata-demo.mx', 'miembro', true);

  // Centro 1 (>50, GR-III): CICLO COMPLETADO con los 5 niveles (6 por nivel → todos visibles).
  const nivelesCompleto = NIVELES.flatMap((n) => Array(6).fill(n)); // 30 empleados, 6 por nivel
  const centro1 = await sembrarCentro({
    companyId: org1.id,
    questionnaireIds: qids,
    nombreCentro: 'Centro Corporativo CDMX',
    headcount: 65,
    guiaLikert: 'GR-III',
    guiaDef: GR3,
    nivelesPorEmpleado: nivelesCompleto,
    prefijoEmail: 'cdmx',
    cicloNombre: 'Ciclo 2026 — Corporativo',
    fechaInicioIso: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    cerrado: true,
  });

  // Centro 2 (16–50, GR-II): CICLO EN CURSO ~40%.
  const nivelesCurso = Array.from({ length: 20 }, (_, i) => NIVELES[i % NIVELES.length]);
  const centro2 = await sembrarCentro({
    companyId: org1.id,
    questionnaireIds: qids,
    nombreCentro: 'Sucursal Monterrey',
    headcount: 30,
    guiaLikert: 'GR-II',
    guiaDef: GR2,
    nivelesPorEmpleado: nivelesCurso,
    prefijoEmail: 'mty',
    cicloNombre: 'Ciclo 2026 — Monterrey',
    fechaInicioIso: new Date().toISOString().slice(0, 10),
    cerrado: false,
    porcentajeCompletado: 0.4,
  });

  // Centro 3 (≤15, solo GR-I): completado.
  const nivelesTaller = Array.from({ length: 12 }, () => 'nulo'); // GR-I no usa Likert; nivel es placeholder
  const centro3 = await sembrarCentro({
    companyId: org1.id,
    questionnaireIds: qids,
    nombreCentro: 'Taller Querétaro',
    headcount: 12,
    guiaLikert: null,
    guiaDef: null,
    nivelesPorEmpleado: nivelesTaller,
    prefijoEmail: 'qro',
    cicloNombre: 'Ciclo 2026 — Querétaro',
    fechaInicioIso: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    cerrado: true,
  });

  const empleadosOrg1 = [...centro1.empleados, ...centro2.empleados, ...centro3.empleados];
  await sembrarPolitica(org1.id, empleadosOrg1);
  await sembrarProgramaConAcciones(org1.id, centro1.cycleId, adminId);
  await sembrarBuzon(org1.id, adminId);
  await sembrarEventoAts(org1.id, centro2.workCenterId, qids, adminId);
  await sembrarCuestionarioPersonalizado(org1.id);
  await sembrarDifusion(org1.id, centro1.cycleId, adminId);
  await activarFlagIa(org1.id);
  await sembrarBorradoresIa(org1.id, centro1.cycleId, adminId);

  // ═══ Org 2: Aislamiento Demo (para demostrar aislamiento entre empresas) ═══
  const org2 = await encontrarOCrear(
    'companies',
    { legal_name: 'Aislamiento Demo, S. de R.L.' },
    { rfc: 'ADE260715XY2', privacy_notice_version: 'v1', status: 'active' },
  );
  console.log(`\nOrg 2: Aislamiento Demo (${org2.id})`);
  await sembrarCuenta(org2.id, 'admin@aislamiento-demo.mx', 'admin_org');
  const nivelesOrg2 = Array.from({ length: 8 }, (_, i) => NIVELES[i % NIVELES.length]);
  await sembrarCentro({
    companyId: org2.id,
    questionnaireIds: qids,
    nombreCentro: 'Oficina Única',
    headcount: 40,
    guiaLikert: 'GR-II',
    guiaDef: GR2,
    nivelesPorEmpleado: nivelesOrg2,
    prefijoEmail: 'ais',
    cicloNombre: 'Ciclo 2026',
    fechaInicioIso: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    cerrado: true,
  });

  console.log('\n════════════ DEMO LISTA ════════════');
  console.log('Org 1 — Constata Demo (completa):');
  console.log('  Admin de Organización : admin@constata-demo.mx / ' + PASSWORD);
  console.log('  Responsable Designado : rd@constata-demo.mx / ' + PASSWORD);
  console.log('Org 2 — Aislamiento Demo (para probar el aislamiento):');
  console.log('  Admin de Organización : admin@aislamiento-demo.mx / ' + PASSWORD);
  console.log(`\n  Ciclo COMPLETADO (5 niveles): Corporativo CDMX · ${centro1.cycleId}`);
  console.log(`  Ciclo EN CURSO (~40%)      : Sucursal Monterrey · ${centro2.cycleId}`);
  console.log(`  Empleados sembrados (Org 1): ${empleadosOrg1.length}`);
}

main().catch((e) => {
  console.error('Error sembrando la demo:', e);
  process.exit(1);
});
