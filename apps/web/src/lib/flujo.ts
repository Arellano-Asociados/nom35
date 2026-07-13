import {
  calificarCuestionario,
  evaluarGR1,
  GR2,
  GR3,
  MOTOR_NOM035_VERSION,
  type DefinicionGuia,
} from '@nom35/motor-nom035';
import { EVENTOS_AUDITORIA, registrarAuditoria } from './auditoria';
import { proveedorCorreo } from './correo';
import {
  construirEntradaGR1,
  construirEntradaLikert,
  ultimaRespuestaPorItem,
  type ConteosGR1,
  type FilaRespuesta,
} from './respuestas';
import { clienteAdmin } from './supabase-admin';
import { hashDeToken } from './tokens';

/** Actor de eventos generados por el sistema (no por un usuario) en audit_log. */
const ACTOR_SISTEMA = '00000000-0000-0000-0000-000000000000';

export type CodigoGuia = 'GR-I' | 'GR-II' | 'GR-III';

export interface Contexto {
  asignacionId: string;
  companyId: string;
  cycleId: string;
  employeeId: string;
  questionnaireId: string;
  guia: CodigoGuia;
  expirado: boolean;
  completado: boolean;
  consentido: boolean;
  filtrosCapturados: boolean;
  empleado: { nombre: string; atiendeClientes: boolean; supervisaPersonal: boolean };
  empresa: { razonSocial: string; versionAvisoPrivacidad: string };
}

export async function obtenerContexto(token: string): Promise<Contexto | null> {
  const supabase = clienteAdmin();
  const { data, error } = await supabase
    .from('questionnaire_assignments')
    .select(
      `id, company_id, cycle_id, employee_id, questionnaire_id, expires_at, completed_at,
       filters_captured_at,
       employees (full_name, attends_customers, supervises_others),
       companies (legal_name, privacy_notice_version),
       questionnaires (code)`,
    )
    .eq('token_hash', hashDeToken(token))
    .maybeSingle();
  if (error) throw new Error(`Error consultando la asignación: ${error.message}`);
  if (!data) return null;

  const empleado = data.employees as unknown as {
    full_name: string;
    attends_customers: boolean;
    supervises_others: boolean;
  };
  const empresa = data.companies as unknown as {
    legal_name: string;
    privacy_notice_version: string | null;
  };
  const guia = (data.questionnaires as unknown as { code: CodigoGuia }).code;

  const { data: consentimiento } = await supabase
    .from('consents')
    .select('id')
    .eq('assignment_id', data.id)
    .maybeSingle();

  return {
    asignacionId: data.id,
    companyId: data.company_id,
    cycleId: data.cycle_id,
    employeeId: data.employee_id,
    questionnaireId: data.questionnaire_id,
    guia,
    expirado: new Date(data.expires_at).getTime() < Date.now(),
    completado: data.completed_at !== null,
    consentido: consentimiento !== null,
    filtrosCapturados: data.filters_captured_at !== null,
    empleado: {
      nombre: empleado.full_name,
      atiendeClientes: empleado.attends_customers,
      supervisaPersonal: empleado.supervises_others,
    },
    empresa: {
      razonSocial: empresa.legal_name,
      versionAvisoPrivacidad: empresa.privacy_notice_version ?? 'v1',
    },
  };
}

export interface Pregunta {
  section: string | null;
  item_number: number;
  text: string;
  /** Encabezado de bloque del DOF que precede a este ítem (solo primer ítem del bloque). */
  instruccion_previa: string | null;
}

export async function obtenerPreguntas(questionnaireId: string): Promise<Pregunta[]> {
  const { data, error } = await clienteAdmin()
    .from('questions')
    .select('section, item_number, text, instruccion_previa')
    .eq('questionnaire_id', questionnaireId)
    .order('section', { ascending: true, nullsFirst: true })
    .order('item_number', { ascending: true });
  if (error) throw new Error(`Error consultando preguntas: ${error.message}`);
  return data;
}

export interface EstructuraItem {
  item_number: number;
  domain: string | null;
  conditional: string | null;
}

export async function obtenerEstructura(questionnaireId: string): Promise<EstructuraItem[]> {
  const { data, error } = await clienteAdmin()
    .from('item_structure')
    .select('item_number, domain, conditional')
    .eq('questionnaire_id', questionnaireId)
    .order('item_number');
  if (error) throw new Error(`Error consultando estructura: ${error.message}`);
  return data;
}

export async function obtenerRespuestas(asignacionId: string): Promise<FilaRespuesta[]> {
  const { data, error } = await clienteAdmin()
    .from('responses')
    .select('id, section, item_number, answer, answered_at')
    .eq('assignment_id', asignacionId);
  if (error) throw new Error(`Error consultando respuestas: ${error.message}`);
  return data;
}

/** Respuestas vigentes como mapa clave→opción para rehidratar la UI (reconexión). */
export async function respuestasVigentes(asignacionId: string): Promise<Record<string, string>> {
  const filas = await obtenerRespuestas(asignacionId);
  const vigentes: Record<string, string> = {};
  for (const [clave, fila] of ultimaRespuestaPorItem(filas)) {
    vigentes[clave] = fila.answer;
  }
  return vigentes;
}

async function conteosGR1(questionnaireId: string): Promise<ConteosGR1> {
  const preguntas = await obtenerPreguntas(questionnaireId);
  const conteos: ConteosGR1 = { I: 0, II: 0, III: 0, IV: 0 };
  for (const p of preguntas) {
    if (p.section === 'I' || p.section === 'II' || p.section === 'III' || p.section === 'IV') {
      conteos[p.section]++;
    }
  }
  return conteos;
}

function definicionDeGuia(guia: CodigoGuia): DefinicionGuia {
  if (guia === 'GR-II') return GR2;
  if (guia === 'GR-III') return GR3;
  throw new Error(`La guía ${guia} no se califica con el motor Likert`);
}

/**
 * Envía el cuestionario: valida completitud, califica con el motor y persiste el resultado
 * INMUTABLE. Devuelve un error legible si el cuestionario no está completo.
 */
export async function enviarCuestionario(ctx: Contexto): Promise<{ error?: string }> {
  const supabase = clienteAdmin();
  const filas = await obtenerRespuestas(ctx.asignacionId);

  try {
    if (ctx.guia === 'GR-I') {
      const entrada = construirEntradaGR1(filas, await conteosGR1(ctx.questionnaireId));
      const resultado = evaluarGR1(entrada);
      const { error } = await supabase.from('gr1_results').insert({
        company_id: ctx.companyId,
        assignment_id: ctx.asignacionId,
        employee_id: ctx.employeeId,
        cycle_id: ctx.cycleId,
        presento_acontecimiento: resultado.presentoAcontecimiento,
        requiere_valoracion: resultado.requiereValoracionClinica,
        secciones_disparadas: resultado.seccionesQueDisparan,
      });
      if (error) throw new Error(error.message);
      if (resultado.requiereValoracionClinica) {
        await notificarResponsableDesignado(ctx.companyId);
      }
    } else {
      const guia = definicionDeGuia(ctx.guia);
      const entrada = construirEntradaLikert(filas, guia, {
        atiendeClientes: ctx.empleado.atiendeClientes,
        supervisaPersonal: ctx.empleado.supervisaPersonal,
      });
      const resultado = calificarCuestionario(entrada, guia);
      const { error } = await supabase.from('risk_results').insert({
        company_id: ctx.companyId,
        assignment_id: ctx.asignacionId,
        employee_id: ctx.employeeId,
        cycle_id: ctx.cycleId,
        questionnaire_id: ctx.questionnaireId,
        cfinal: resultado.cfinal,
        nivel_final: resultado.nivelFinal,
        categorias: resultado.categorias,
        dominios: resultado.dominios,
        engine_version: MOTOR_NOM035_VERSION,
      });
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al calificar el cuestionario' };
  }

  const { error } = await supabase
    .from('questionnaire_assignments')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', ctx.asignacionId)
    .is('completed_at', null);
  if (error) return { error: error.message };
  return {};
}

export interface PoliticaPendienteInfo {
  id: string;
  titulo: string;
  version: string;
  url: string | null;
}

/** Política de prevención vigente que el empleado aún no acusa (evidencia de difusión). */
export async function politicaPendienteDe(ctx: Contexto): Promise<PoliticaPendienteInfo | null> {
  const supabase = clienteAdmin();
  const { data: politica } = await supabase
    .from('policies')
    .select('id, title, version, storage_path')
    .eq('company_id', ctx.companyId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!politica) return null;

  const { data: acuse } = await supabase
    .from('policy_acknowledgments')
    .select('id')
    .eq('policy_id', politica.id)
    .eq('employee_id', ctx.employeeId)
    .maybeSingle();
  if (acuse) return null;

  const { data: firmado } = await supabase.storage
    .from('politicas')
    .createSignedUrl(politica.storage_path, 3600);

  return {
    id: politica.id,
    titulo: politica.title,
    version: politica.version,
    url: firmado?.signedUrl ?? null,
  };
}

/**
 * Notifica a los Responsables Designados que hay una canalización GR-I pendiente.
 * El correo NO incluye datos del trabajador ni del resultado (regla inviolable 9);
 * el evento queda en audit_log.
 */
async function notificarResponsableDesignado(companyId: string): Promise<void> {
  const supabase = clienteAdmin();
  const { data: designados } = await supabase
    .from('role_assignments')
    .select('auth_user_id')
    .eq('company_id', companyId)
    .eq('is_designated_responsible', true);

  const correos: string[] = [];
  for (const fila of designados ?? []) {
    const { data } = await supabase.auth.admin.getUserById(fila.auth_user_id);
    if (data.user?.email) correos.push(data.user.email);
  }

  if (correos.length > 0) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
    await proveedorCorreo().enviar({
      para: correos,
      asunto: 'NOM-035: nueva canalización pendiente',
      html: `<p>Hay una nueva canalización GR-I pendiente de atención.</p>
             <p>Ingresa a la plataforma para revisarla: <a href="${base}">${base}</a></p>`,
    });
  }

  // Último insert directo a audit_log que quedaba: ahora pasa por el helper compartido,
  // que revisa el error y usa el catálogo tipado de eventos (pendiente post-M6, cerrado).
  await registrarAuditoria(
    companyId,
    ACTOR_SISTEMA,
    EVENTOS_AUDITORIA.gr1NotificacionDr,
    'gr1_results',
    undefined,
    { destinatarios: correos.length },
  );
}

/**
 * Deja rastro de que el titular consultó su propio resultado (regla inviolable 5: el
 * acceso a un resultado individual procesado SIEMPRE se audita). El actor es el sistema
 * —el trabajador no tiene cuenta de auth, su capacidad es el token— y no se registra
 * ningún dato del resultado, solo que hubo consulta y sobre qué asignación.
 * Fire-and-forget deliberado: a diferencia del acceso del RD (fail-closed), aquí el
 * titular tiene derecho a ver SU dato aunque la bitácora falle; el fallo se loggea.
 */
export async function registrarConsultaResultadoPropio(ctx: Contexto): Promise<void> {
  await registrarAuditoria(
    ctx.companyId,
    ACTOR_SISTEMA,
    EVENTOS_AUDITORIA.resultadoPropioConsultado,
    'questionnaire_assignments',
    ctx.asignacionId,
    { guia: ctx.guia },
  );
}
