// Seed de demo: crea (si no existen) los datos de "Empresa Demo NOM-035" con dos centros de
// trabajo (uno >50 → GR-I+GR-III, uno 16-50 → GR-I+GR-II), ~30 empleados, un ciclo por centro,
// asignaciones, respuestas y resultados calculados por el MOTOR REAL (@nom35/motor-nom035),
// una política publicada con acuses, capacitación con registros, acciones de la Tabla 7 y las
// cuentas de demo (Admin de Organización + Responsable Designado).
//
// Requisitos (ver docs/demo.md):
//   - Supabase local arriba (`pnpm exec supabase start` + `pnpm exec supabase db reset`).
//   - El motor debe compilarse primero: `pnpm demo:seed` ya encadena
//     `pnpm --filter @nom35/motor-nom035 run build` porque el paquete se consume como fuente
//     TypeScript ("type":"module", sin dist/) y este script es Node puro sin loader de TS;
//     el build alterno (tsconfig.build.json) emite CommonJS en dist/ SOLO para este uso.
//
// Idempotencia: por NOMBRE/CLAVE NATURAL (razón social, email, título, etc.), no por conteo de
// filas. Volver a correr el script no duplica nada; complementa lo que falte.
//
// Seguridad: rechaza correr contra un proyecto que no luzca local, salvo DEMO_ALLOW=1.

/* eslint-disable no-console -- CLI de seed: los mensajes de progreso son operativos (no son
   respuestas ni resultados de trabajadores; regla 9 de CLAUDE.md aplica a logs de la
   aplicación, no a la salida de esta herramienta de desarrollo). */

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
  console.error(
    'Falta SUPABASE_SERVICE_ROLE_KEY en el entorno (lo imprime `pnpm exec supabase start`).',
  );
  process.exit(1);
}

const pareceLocal = /127\.0\.0\.1|localhost/.test(SUPABASE_URL);
if (!pareceLocal && process.env.DEMO_ALLOW !== '1') {
  console.error(
    `NEXT_PUBLIC_SUPABASE_URL (${SUPABASE_URL}) no luce local. Este seed es solo para demo/desarrollo.\n` +
      'Si de verdad quieres correrlo contra ese proyecto, define DEMO_ALLOW=1 explícitamente.',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMIN_EMAIL = 'admin@demo.nom035.mx';
const ADMIN_PASSWORD = 'DemoNom035!2026';
const RD_EMAIL = 'rd@demo.nom035.mx';
const RD_PASSWORD = 'DemoNom035!2026';
const RAZON_SOCIAL = 'Empresa Demo NOM-035, S.A. de C.V.';

// ─── Helpers genéricos de idempotencia (buscar por clave natural, crear si falta) ────────────

async function buscarUno(tabla, filtro, columnas = 'id') {
  let consulta = supabase.from(tabla).select(columnas);
  for (const [clave, valor] of Object.entries(filtro)) consulta = consulta.eq(clave, valor);
  const { data, error } = await consulta.maybeSingle();
  if (error) throw new Error(`${tabla} (buscar ${JSON.stringify(filtro)}): ${error.message}`);
  return data;
}

async function crearUno(tabla, valores, columnas = 'id') {
  const { data, error } = await supabase.from(tabla).insert(valores).select(columnas).single();
  if (error) throw new Error(`${tabla} (crear): ${error.message}`);
  return data;
}

/** Busca por `filtro` (clave natural); si no existe, inserta `{ ...filtro, ...extra }`. */
async function encontrarOCrear(tabla, filtro, extra = {}, columnas = 'id') {
  const existente = await buscarUno(tabla, filtro, columnas);
  if (existente) return existente;
  return crearUno(tabla, { ...filtro, ...extra }, columnas);
}

async function contarFilas(tabla, filtro) {
  let consulta = supabase.from(tabla).select('id', { count: 'exact', head: true });
  for (const [clave, valor] of Object.entries(filtro)) consulta = consulta.eq(clave, valor);
  const { count, error } = await consulta;
  if (error) throw new Error(`${tabla} (contar ${JSON.stringify(filtro)}): ${error.message}`);
  return count ?? 0;
}

async function encontrarOCrearUsuario(email, password) {
  // Paginado amplio: alcanza sobradamente para el puñado de cuentas de este seed (mismo
  // patrón que accionAgregarConsultor en apps/web/src/acciones/panel.ts).
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`auth.admin.listUsers: ${error.message}`);
  const existente = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existente) return existente.id;

  const { data: creado, error: errorCrear } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (errorCrear) throw new Error(`auth.admin.createUser(${email}): ${errorCrear.message}`);
  return creado.user.id;
}

function hashDeToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function generarToken() {
  return randomBytes(32).toString('base64url');
}

// ─── Helpers del motor: construir vectores de respuesta que produzcan un nivel objetivo ──────
// No se inventan puntajes a mano: se arma un vector de respuestas Likert cuya suma total sea
// el objetivo, y se corre por calificarCuestionario/evaluarGR1 (los mismos del paquete real).
// Distribuye `total` entre `cantidadItems` enteros en [0,4] (scoring_rules: rango por ítem).

function distribuirPuntaje(total, cantidadItems) {
  const totalAcotado = Math.max(0, Math.min(total, cantidadItems * 4));
  const base = Math.floor(totalAcotado / cantidadItems);
  const resto = totalAcotado - base * cantidadItems;
  const puntajes = [];
  for (let indice = 0; indice < cantidadItems; indice++) {
    puntajes.push(indice < resto ? base + 1 : base);
  }
  return puntajes;
}

const OPCIONES_LIKERT = ['siempre', 'casi_siempre', 'algunas_veces', 'casi_nunca', 'nunca'];

/** Grupo A: Siempre=0…Nunca=4 (directo). Grupo B: Siempre=4…Nunca=0 (inverso). */
function respuestaDesdeScore(score, grupo) {
  const indice = grupo === 'A' ? score : 4 - score;
  return OPCIONES_LIKERT[indice];
}

/**
 * Construye la entrada del motor (GR-II/GR-III) + las filas para `responses`, apuntando a que
 * calificarCuestionario(entrada, guia) devuelva un cfinal cercano a `cfinalObjetivo`. Los ítems
 * condicionales que no aplican según los filtros del empleado se omiten (el motor los puntúa
 * como "Nunca" internamente; regla normativa).
 */
function construirRespuestasLikert(guia, filtros, cfinalObjetivo) {
  const noAplican = new Set([
    ...(filtros.atiendeClientes ? [] : guia.itemsCondicionales.atiendeClientes),
    ...(filtros.supervisaPersonal ? [] : guia.itemsCondicionales.supervisaPersonal),
  ]);

  const itemsAResponder = [];
  for (let item = 1; item <= guia.totalItems; item++) {
    if (!noAplican.has(item)) itemsAResponder.push(item);
  }

  const puntajes = distribuirPuntaje(cfinalObjetivo, itemsAResponder.length);
  const respuestas = {};
  const filas = [];
  itemsAResponder.forEach((item, indice) => {
    const grupo = guia.grupoDeItem[item];
    const respuesta = respuestaDesdeScore(puntajes[indice], grupo);
    respuestas[item] = respuesta;
    filas.push({ item_number: item, answer: respuesta });
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

/** Perfil de respuestas de la GR-I (Sí/No por sección) → entrada del motor + filas de `responses`. */
function construirRespuestasGR1(perfil) {
  const filas = [];
  const entrada = { seccionI: perfil.seccionI };
  filas.push(
    ...perfil.seccionI.map((si, i) => ({
      section: 'I',
      item_number: i + 1,
      answer: si ? 'si' : 'no',
    })),
  );
  for (const seccion of ['seccionII', 'seccionIII', 'seccionIV']) {
    if (perfil[seccion]) {
      entrada[seccion] = perfil[seccion];
      const nombreSeccion = seccion.replace('seccion', '');
      filas.push(
        ...perfil[seccion].map((si, i) => ({
          section: nombreSeccion,
          item_number: i + 1,
          answer: si ? 'si' : 'no',
        })),
      );
    }
  }
  return { entrada, filas };
}

// Objetivos de cfinal por nivel (dentro de cada rango de risk_level_ranges de datos/gr2.ts y
// datos/gr3.ts), pensados para caer cómodamente lejos de los bordes.
const OBJETIVO_CFINAL_GR3 = { nulo: 25, bajo: 62, medio: 87, alto: 120, muy_alto: 200 };
const OBJETIVO_CFINAL_GR2 = { nulo: 10, bajo: 32, medio: 57, alto: 80, muy_alto: 130 };
const NIVELES = ['nulo', 'bajo', 'medio', 'alto', 'muy_alto'];

// ─── Datos de las ~30 personas de la demo ────────────────────────────────────

const AREAS = ['Ventas', 'Producción', 'Administración', 'Logística'];

function generarPerfilesEmpleados(prefijoEmail, cantidad, niveles = NIVELES) {
  const perfiles = [];
  for (let i = 0; i < cantidad; i++) {
    perfiles.push({
      nombre: `Empleado Demo ${prefijoEmail.toUpperCase()}-${i + 1}`,
      email: `${prefijoEmail}-empleado-${i + 1}@demo.nom035.mx`,
      area: AREAS[i % AREAS.length],
      atiendeClientes: i % 3 === 0,
      supervisaPersonal: i % 4 === 0,
      nivel: niveles[i % niveles.length],
      // Al último de cada centro lo dejamos sin completar: ilustra el estado "en curso" del
      // ciclo (progreso por área, recordatorios) sin necesidad de tocar la BD dos veces.
      pendiente: i === cantidad - 1,
    });
  }
  return perfiles;
}

// Centro Sucursal Guadalajara (Centro B) rota solo 3 niveles, no los 5: con 12 empleados (11
// completados) sobre 5 niveles, la rotación NIVELES[i%5] produce nulo=3/bajo=2/medio=2/alto=2/
// muy_alto=2 — las cuatro celdas con n=2 quedan suprimidas por la regla base (0<n<3) con
// k=4 y S=8=2k, lo que dispara la supresión complementaria por descomposición forzada
// (lib/agregados.ts: aplicarSupresionComplementaria) y esta, al no quedar ninguna otra celda
// visible positiva salvo nulo, termina suprimiendo TAMBIÉN nulo: la tabla global de Cfinal de
// este centro queda 100% suprimida, contradiciendo la distribución real que promete
// docs/demo.md. Con 3 niveles (nulo/medio/alto) sobre 11 completados el resultado es 4/4/3:
// ninguna celda cae en 0<n<3, así que k=0 y no hay supresión alguna a nivel global (los
// filtros por área siguen mostrando supresión real, con celdas más pequeñas).
const NIVELES_ROTACION_CENTRO_B = ['nulo', 'medio', 'alto'];

// GR-I: perfil "sin acontecimiento" (mayoría), y un par de casos con acontecimiento traumático
// para mostrar variedad — uno dispara canalización (y lo marcamos "canalizado"), el otro no.
const GR1_SIN_EVENTO = { seccionI: [false, false, false, false, false, false] };
const GR1_CON_EVENTO_CANALIZADO = {
  seccionI: [true, false, false, false, false, false],
  seccionII: [true, false],
  seccionIII: [false, false, false, false, false, false, false],
  seccionIV: [false, false, false, false, false],
};
const GR1_CON_EVENTO_SIN_VALORACION = {
  seccionI: [true, false, false, false, false, false],
  seccionII: [false, false],
  seccionIII: [true, true, false, false, false, false, false],
  seccionIV: [true, false, false, false, false],
};

// ─── Pasos del seed ──────────────────────────────────────────────────────────

async function obtenerQuestionnaireIds() {
  const { data, error } = await supabase.from('questionnaires').select('id, code');
  if (error) throw new Error(`questionnaires: ${error.message}`);
  const mapa = new Map(data.map((fila) => [fila.code, fila.id]));
  for (const codigo of ['GR-I', 'GR-II', 'GR-III']) {
    if (!mapa.has(codigo)) {
      throw new Error(
        `No existe el cuestionario ${codigo} en catálogo: ¿corriste \`supabase db reset\`?`,
      );
    }
  }
  return mapa;
}

async function crearEmpresa() {
  const empresa = await encontrarOCrear(
    'companies',
    { legal_name: RAZON_SOCIAL },
    { rfc: 'DNO260711AB3', privacy_notice_version: 'v1' },
  );
  console.log(`Empresa: ${RAZON_SOCIAL} (${empresa.id})`);
  return empresa.id;
}

async function crearCentro(companyId, nombre, headcount) {
  const centro = await encontrarOCrear(
    'work_centers',
    { company_id: companyId, name: nombre },
    { headcount },
    'id, nom_category',
  );
  console.log(`  Centro: ${nombre} (headcount ${headcount}, categoría ${centro.nom_category})`);
  return centro;
}

async function crearCiclo(companyId, workCenterId, nombre, evaluador) {
  const ciclo = await encontrarOCrear(
    'compliance_cycles',
    { company_id: companyId, work_center_id: workCenterId, name: nombre },
    {
      date_start: new Date().toISOString().slice(0, 10),
      evaluator_name: evaluador.nombre,
      evaluator_license: evaluador.cedula,
    },
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
  const creada = await crearUno(
    'questionnaire_assignments',
    {
      company_id: companyId,
      cycle_id: cycleId,
      employee_id: employeeId,
      questionnaire_id: questionnaireId,
      token_hash: hashDeToken(token),
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
    'id',
  );
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
  const { error } = await supabase
    .from('questionnaire_assignments')
    .update({
      completed_at: new Date().toISOString(),
      filters_captured_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
    .is('completed_at', null);
  if (error) throw new Error(`questionnaire_assignments (completar): ${error.message}`);
}

/** Inserta responses + risk_results para una asignación Likert, si aún no tiene. */
async function sembrarResultadoLikert(ctx) {
  const {
    companyId,
    employeeId,
    cycleId,
    questionnaireId,
    assignmentId,
    guia,
    filtros,
    nivel,
    guiaDef,
  } = ctx;
  if ((await contarFilas('responses', { assignment_id: assignmentId })) > 0) return;

  const objetivo = (guia === 'GR-III' ? OBJETIVO_CFINAL_GR3 : OBJETIVO_CFINAL_GR2)[nivel];
  const { entrada, filas } = construirRespuestasLikert(guiaDef, filtros, objetivo);
  const resultado = calificarCuestionario(entrada, guiaDef);

  const { error: errorResponses } = await supabase.from('responses').insert(
    filas.map((f) => ({
      company_id: companyId,
      assignment_id: assignmentId,
      section: null,
      item_number: f.item_number,
      answer: f.answer,
    })),
  );
  if (errorResponses) throw new Error(`responses (${guia}): ${errorResponses.message}`);

  if ((await contarFilas('risk_results', { assignment_id: assignmentId })) === 0) {
    const { error } = await supabase.from('risk_results').insert({
      company_id: companyId,
      assignment_id: assignmentId,
      employee_id: employeeId,
      cycle_id: cycleId,
      questionnaire_id: questionnaireId,
      cfinal: resultado.cfinal,
      nivel_final: resultado.nivelFinal,
      categorias: resultado.categorias,
      dominios: resultado.dominios,
      engine_version: MOTOR_NOM035_VERSION,
    });
    if (error) throw new Error(`risk_results: ${error.message}`);
  }
}

/** Inserta responses + gr1_results para una asignación GR-I, si aún no tiene. */
async function sembrarResultadoGR1(ctx) {
  const { companyId, employeeId, cycleId, assignmentId, perfil } = ctx;
  if ((await contarFilas('responses', { assignment_id: assignmentId })) > 0) return null;

  const { entrada, filas } = construirRespuestasGR1(perfil);
  const resultado = evaluarGR1(entrada);

  const { error: errorResponses } = await supabase.from('responses').insert(
    filas.map((f) => ({
      company_id: companyId,
      assignment_id: assignmentId,
      section: f.section,
      item_number: f.item_number,
      answer: f.answer,
    })),
  );
  if (errorResponses) throw new Error(`responses (GR-I): ${errorResponses.message}`);

  if ((await contarFilas('gr1_results', { assignment_id: assignmentId })) === 0) {
    const creado = await crearUno(
      'gr1_results',
      {
        company_id: companyId,
        assignment_id: assignmentId,
        employee_id: employeeId,
        cycle_id: cycleId,
        presento_acontecimiento: resultado.presentoAcontecimiento,
        requiere_valoracion: resultado.requiereValoracionClinica,
        secciones_disparadas: resultado.seccionesQueDisparan,
      },
      'id',
    );
    return creado.id;
  }
  return null;
}

async function sembrarCentro({
  companyId,
  questionnaireIds,
  nombreCentro,
  headcount,
  guiaLikert,
  guiaDef,
  cantidadEmpleados,
  prefijoEmail,
  nivelesRotacion,
}) {
  const centro = await crearCentro(companyId, nombreCentro, headcount);
  const cycleId = await crearCiclo(companyId, centro.id, 'Ciclo 2026', {
    nombre: 'Dra. Consultora Demo',
    cedula: 'CED-DEMO-001',
  });

  const perfiles = generarPerfilesEmpleados(prefijoEmail, cantidadEmpleados, nivelesRotacion);
  const tokensPendientes = [];
  const empleadosCreados = [];

  for (const [indice, perfil] of perfiles.entries()) {
    const empleado = await crearEmpleado(companyId, centro.id, perfil);
    empleadosCreados.push({ ...perfil, id: empleado.id });

    const asignacionGR1 = await crearAsignacion(
      companyId,
      cycleId,
      empleado.id,
      questionnaireIds.get('GR-I'),
    );
    const asignacionLikert = await crearAsignacion(
      companyId,
      cycleId,
      empleado.id,
      questionnaireIds.get(guiaLikert),
    );

    if (perfil.pendiente) {
      if (asignacionGR1.token)
        tokensPendientes.push({
          guia: 'GR-I',
          token: asignacionGR1.token,
          empleado: perfil.nombre,
        });
      if (asignacionLikert.token)
        tokensPendientes.push({
          guia: guiaLikert,
          token: asignacionLikert.token,
          empleado: perfil.nombre,
        });
      continue;
    }

    await asegurarConsentimiento(companyId, asignacionGR1.id, empleado.id);
    await asegurarConsentimiento(companyId, asignacionLikert.id, empleado.id);

    // Los dos primeros empleados NO últimos de cada centro ilustran variedad de GR-I; el resto
    // no presenta acontecimiento traumático (mayoría realista).
    let perfilGR1 = GR1_SIN_EVENTO;
    let esCasoCanalizado = false;
    if (indice === 1) {
      perfilGR1 = GR1_CON_EVENTO_CANALIZADO;
      esCasoCanalizado = true;
    } else if (indice === 2) {
      perfilGR1 = GR1_CON_EVENTO_SIN_VALORACION;
    }

    const gr1Id = await sembrarResultadoGR1({
      companyId,
      employeeId: empleado.id,
      cycleId,
      assignmentId: asignacionGR1.id,
      perfil: perfilGR1,
    });
    if (esCasoCanalizado && gr1Id) {
      const { error } = await supabase
        .from('gr1_results')
        .update({
          canalizacion_estatus: 'canalizado',
          canalizacion_fecha: new Date().toISOString().slice(0, 10),
        })
        .eq('id', gr1Id);
      if (error) throw new Error(`gr1_results (canalización): ${error.message}`);
    }

    await sembrarResultadoLikert({
      companyId,
      employeeId: empleado.id,
      cycleId,
      questionnaireId: questionnaireIds.get(guiaLikert),
      assignmentId: asignacionLikert.id,
      guia: guiaLikert,
      guiaDef,
      filtros: {
        atiendeClientes: perfil.atiendeClientes,
        supervisaPersonal: perfil.supervisaPersonal,
      },
      nivel: perfil.nivel,
    });

    await marcarCompletada(asignacionGR1.id);
    await marcarCompletada(asignacionLikert.id);
  }

  console.log(
    `  ${nombreCentro}: ${perfiles.length} empleados (${guiaLikert}), ciclo ${cycleId}, ${tokensPendientes.length} asignaciones dejadas pendientes para demo en vivo`,
  );
  return { cycleId, workCenterId: centro.id, empleados: empleadosCreados, tokensPendientes };
}

// ─── Política, capacitación y acciones (Tabla 7) ────────────────────────────

const TEXTO_POLITICA = `Política de Prevención de Riesgos Psicosociales
Empresa Demo NOM-035, S.A. de C.V.

(Documento de demostración generado por scripts/demo-seed.mjs — NO usar en un centro de
trabajo real.)

Esta empresa se compromete a prevenir los factores de riesgo psicosocial, promover un entorno
organizacional favorable y atender los actos de violencia laboral, conforme a la
NOM-035-STPS-2018. Las medidas incluyen: difusión de esta política a todo el personal,
identificación y análisis de los factores de riesgo psicosocial mediante los cuestionarios de
las Guías de Referencia I, II y III, y la implementación de acciones de prevención y control
proporcionales a los niveles de riesgo detectados.
`;

async function sembrarPolitica(companyId, empleados) {
  const rutaArchivo = `${companyId}/politica-prevencion-demo.txt`;
  const { error: errorSubida } = await supabase.storage
    .from('politicas')
    .upload(rutaArchivo, Buffer.from(TEXTO_POLITICA, 'utf-8'), {
      contentType: 'text/plain',
      upsert: true,
    });
  if (errorSubida) throw new Error(`storage/politicas: ${errorSubida.message}`);

  const politica = await encontrarOCrear(
    'policies',
    {
      company_id: companyId,
      title: 'Política de Prevención de Riesgos Psicosociales',
      version: 'v1',
    },
    { storage_path: rutaArchivo },
  );

  // Acuse de ~la mitad de los empleados completos (evidencia de difusión parcial: realista).
  const conAcuse = empleados.filter((_e, i) => i % 2 === 0);
  for (const empleado of conAcuse) {
    await encontrarOCrear(
      'policy_acknowledgments',
      { policy_id: politica.id, employee_id: empleado.id },
      {
        company_id: companyId,
      },
    );
  }
  console.log(`  Política publicada con ${conAcuse.length}/${empleados.length} acuses`);
}

async function sembrarCapacitacion(companyId, empleados) {
  const contenidos = [
    {
      title: 'Capacitación NOM-035: identificación de factores de riesgo psicosocial',
      texto: 'Contenido de demostración: identificación de factores de riesgo psicosocial.',
    },
    {
      title: 'Capacitación NOM-035: prevención de la violencia laboral',
      texto: 'Contenido de demostración: prevención y atención de la violencia laboral.',
    },
  ];

  for (const contenido of contenidos) {
    const rutaArchivo = `${companyId}/${contenido.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
    const { error: errorSubida } = await supabase.storage
      .from('capacitacion')
      .upload(rutaArchivo, Buffer.from(contenido.texto, 'utf-8'), {
        contentType: 'text/plain',
        upsert: true,
      });
    if (errorSubida) throw new Error(`storage/capacitacion: ${errorSubida.message}`);

    const contenidoCreado = await encontrarOCrear(
      'training_contents',
      { company_id: companyId, title: contenido.title },
      { storage_path: rutaArchivo },
    );

    const conRegistro = empleados.filter((_e, i) => i % 2 === 1);
    for (const empleado of conRegistro) {
      await encontrarOCrear(
        'training_records',
        { training_id: contenidoCreado.id, employee_id: empleado.id },
        {
          company_id: companyId,
        },
      );
    }
  }
  console.log(`  Capacitación: ${contenidos.length} contenidos publicados`);
}

async function sembrarAcciones(companyId, cycleIdCentroA, cycleIdCentroB) {
  const acciones = [
    {
      cycle_id: cycleIdCentroA,
      description:
        'Revisar y equilibrar las cargas de trabajo: distribución, plazos y pausas (Factores propios de la actividad)',
      origin_level: 'muy_alto',
      responsible: 'Recursos Humanos',
    },
    {
      cycle_id: cycleIdCentroA,
      description:
        'Capacitar a mandos medios y directivos en liderazgo y comunicación efectiva (Liderazgo y relaciones en el trabajo)',
      origin_level: 'alto',
      responsible: 'Dirección de Operaciones',
    },
    {
      cycle_id: cycleIdCentroA,
      description: 'Establecer mecanismos de reconocimiento del desempeño (Entorno organizacional)',
      origin_level: 'medio',
      responsible: 'Recursos Humanos',
    },
    {
      cycle_id: cycleIdCentroB,
      description:
        'Revisar la organización de jornadas y respetar los tiempos de descanso (Organización del tiempo de trabajo)',
      origin_level: 'alto',
      responsible: 'Gerencia de Centro',
    },
  ];
  for (const accion of acciones) {
    await encontrarOCrear(
      'action_items',
      { company_id: companyId, cycle_id: accion.cycle_id, description: accion.description },
      { origin_level: accion.origin_level, responsible: accion.responsible },
    );
  }
  console.log(`  Acciones (Tabla 7): ${acciones.length} registradas`);
}

// ─── Cuentas y membresías ─────────────────────────────────────────────────────

async function sembrarCuentas(companyId) {
  const adminId = await encontrarOCrearUsuario(ADMIN_EMAIL, ADMIN_PASSWORD);
  await supabase
    .from('role_assignments')
    .upsert(
      { company_id: companyId, auth_user_id: adminId, role: 'admin_org' },
      { onConflict: 'company_id,auth_user_id' },
    );

  const rdId = await encontrarOCrearUsuario(RD_EMAIL, RD_PASSWORD);
  await supabase.from('role_assignments').upsert(
    {
      company_id: companyId,
      auth_user_id: rdId,
      role: 'miembro',
      is_designated_responsible: true,
    },
    { onConflict: 'company_id,auth_user_id' },
  );

  console.log(`  Cuentas: admin_org=${ADMIN_EMAIL}, Responsable Designado=${RD_EMAIL}`);
}

// ─── Registro (fire-and-forget, no bloquea el seed si falla) ────────────────

async function registrarAuditoriaDemo(companyId, actorUserId, eventType, entity) {
  await supabase.from('audit_log').insert({
    company_id: companyId,
    actor_user_id: actorUserId,
    event_type: eventType,
    entity: entity ?? null,
  });
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Sembrando demo contra ${SUPABASE_URL} …`);
  const questionnaireIds = await obtenerQuestionnaireIds();
  const companyId = await crearEmpresa();

  const centroA = await sembrarCentro({
    companyId,
    questionnaireIds,
    nombreCentro: 'Centro Corporativo CDMX',
    headcount: 65,
    guiaLikert: 'GR-III',
    guiaDef: GR3,
    cantidadEmpleados: 18,
    prefijoEmail: 'a',
  });

  const centroB = await sembrarCentro({
    companyId,
    questionnaireIds,
    nombreCentro: 'Centro Sucursal Guadalajara',
    headcount: 30,
    guiaLikert: 'GR-II',
    guiaDef: GR2,
    cantidadEmpleados: 12,
    prefijoEmail: 'b',
    nivelesRotacion: NIVELES_ROTACION_CENTRO_B,
  });

  const todosLosEmpleadosCompletos = [...centroA.empleados, ...centroB.empleados].filter(
    (e) => !e.pendiente,
  );
  await sembrarPolitica(companyId, todosLosEmpleadosCompletos);
  await sembrarCapacitacion(companyId, todosLosEmpleadosCompletos);
  await sembrarAcciones(companyId, centroA.cycleId, centroB.cycleId);
  await sembrarCuentas(companyId);

  const adminId = await encontrarOCrearUsuario(ADMIN_EMAIL, ADMIN_PASSWORD);
  await registrarAuditoriaDemo(companyId, adminId, 'empresa_creada', 'companies');
  await registrarAuditoriaDemo(companyId, adminId, 'empleados_importados', 'employees');

  console.log('\nListo. Resumen:');
  console.log(`  companyId: ${companyId}`);
  console.log(`  Ciclo Centro A (GR-III): ${centroA.cycleId}`);
  console.log(`  Ciclo Centro B (GR-II): ${centroB.cycleId}`);
  console.log(`  Admin de Organización: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Responsable Designado: ${RD_EMAIL} / ${RD_PASSWORD}`);

  const tokensPendientes = [...centroA.tokensPendientes, ...centroB.tokensPendientes];
  if (tokensPendientes.length > 0) {
    console.log(
      '\n  Asignaciones dejadas SIN completar (para mostrar el flujo del empleado en vivo):',
    );
    for (const t of tokensPendientes) {
      console.log(`    ${t.empleado} · ${t.guia} · http://localhost:3000/responder/${t.token}`);
    }
  }
}

main().catch((error) => {
  console.error('Error sembrando la demo:', error);
  process.exit(1);
});
