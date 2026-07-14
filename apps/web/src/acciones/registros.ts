'use server';

import { createHash } from 'node:crypto';
import { registrarAuditoriaEstricta } from '@/lib/auditoria';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { fechaEsMx } from '@/lib/fechas';
import {
  csvRegistro58a,
  csvRegistro58c,
  filasRegistro58a,
  type EntradaRegistro58c,
  type FilaResultado58a,
  type NivelNombrado,
} from '@/lib/registros-58';
import { clienteAdmin } from '@/lib/supabase-admin';

// Registros del 5.8 exportables por el Responsable Designado.
//
// Ambos son datos de salud POR PERSONA: se generan bajo demanda (ante una inspección),
// se entregan directo al navegador del RD y NO pasan por Storage — un CSV con niveles de
// riesgo nominales guardado en un bucket es una superficie de fuga que la norma no exige.
//
// Auditoría FAIL-CLOSED (regla inviolable 5): si el evento no se pudo registrar, no hay
// CSV. Para el 5.8 a) se exige además un `individual_result_access` POR CADA resultado
// incluido: el registro es, literalmente, una consulta masiva de resultados individuales,
// y la bitácora debe reflejar cada uno igual que si el RD los hubiera abierto en pantalla.

export type ResultadoRegistro =
  { ok: true; nombre: string; contenido: string } | { ok: false; error: string };

const SOLO_RD =
  'Este registro contiene datos personales sensibles de salud: solo puede generarlo el Responsable Designado.';
const AUDITORIA_FALLIDA =
  'No se pudo dejar constancia de esta consulta en la bitácora de auditoría, así que el registro no se generó. Vuelve a intentarlo.';

function base64(contenido: Buffer): string {
  return contenido.toString('base64');
}

function sha256Hex(contenido: Buffer): string {
  return createHash('sha256').update(contenido).digest('hex');
}

/** 5.8 a) Registro de resultados de la identificación/análisis y de la evaluación del EOF. */
export async function accionRegistro58a(
  companyId: string,
  cicloId: string,
): Promise<ResultadoRegistro> {
  const acceso = await autorizarEmpresa(companyId);
  if (!acceso.membresia.esResponsableDesignado) return { ok: false, error: SOLO_RD };

  // service_role legítimo: risk_results no tiene GRANT para authenticated (regla 5);
  // el único camino al dato individual es esta app, con guardia de RD y auditoría.
  const supabase = clienteAdmin();
  const { data } = await supabase
    .from('risk_results')
    .select(
      'id, assignment_id, supersedes_id, created_at, cfinal, nivel_final, categorias, dominios, engine_version, employees (full_name, work_centers (name)), questionnaires (code)',
    )
    .eq('company_id', companyId)
    .eq('cycle_id', cicloId);

  const filas: FilaResultado58a[] = (data ?? []).map((r) => {
    const empleado = r.employees as unknown as {
      full_name: string;
      work_centers: { name: string };
    };
    return {
      id: r.id,
      assignmentId: r.assignment_id,
      supersedesId: r.supersedes_id,
      createdAt: r.created_at,
      nombreEmpleado: empleado.full_name,
      nombreCentro: empleado.work_centers.name,
      guia: (r.questionnaires as unknown as { code: string }).code,
      cfinal: r.cfinal,
      nivelFinal: r.nivel_final,
      categorias: (r.categorias ?? []) as NivelNombrado[],
      dominios: (r.dominios ?? []) as NivelNombrado[],
      versionMotor: r.engine_version,
    };
  });

  const vigentes = filasRegistro58a(filas);
  const contenido = csvRegistro58a(filas);

  // Un evento POR RESULTADO incluido, ANTES de entregar el archivo: el registro expone
  // exactamente los mismos datos que abrir cada ficha individual (regla 5).
  for (const r of vigentes) {
    const ok = await registrarAuditoriaEstricta(
      companyId,
      acceso.userId,
      'individual_result_access',
      'risk_results',
      r.id,
      { via: 'registro_58a', ciclo_id: cicloId },
    );
    if (!ok) return { ok: false, error: AUDITORIA_FALLIDA };
  }

  const ok = await registrarAuditoriaEstricta(
    companyId,
    acceso.userId,
    'registro_58a_generado',
    'compliance_cycles',
    cicloId,
    { resultados: vigentes.length, sha256: sha256Hex(contenido) },
  );
  if (!ok) return { ok: false, error: AUDITORIA_FALLIDA };

  return { ok: true, nombre: 'registro-5-8-a-resultados.csv', contenido: base64(contenido) };
}

/**
 * 5.8 c) Relación de trabajadores sujetos a exámenes o valoraciones clínicas.
 *
 * Abarca TODA la empresa, no el ciclo: el 5.8 obliga al patrón a conservar los registros
 * del centro de trabajo, y la GR-I se aplica por dos vías (ciclo ordinario y evento
 * traumático). La columna `origen` dice de cuál viene cada renglón.
 */
export async function accionRegistro58c(companyId: string): Promise<ResultadoRegistro> {
  const acceso = await autorizarEmpresa(companyId);
  if (!acceso.membresia.esResponsableDesignado) return { ok: false, error: SOLO_RD };

  // service_role legítimo: gr1_results no tiene GRANT para authenticated (regla 5).
  const supabase = clienteAdmin();
  const { data } = await supabase
    .from('gr1_results')
    .select(
      'id, presento_acontecimiento, requiere_valoracion, canalizacion_estatus, canalizacion_fecha, created_at, employees (full_name, work_centers (name)), compliance_cycles (name, traumatic_event_id, traumatic_events (occurred_on))',
    )
    .eq('company_id', companyId)
    .order('created_at');

  const filas: EntradaRegistro58c[] = (data ?? []).map((r) => {
    const empleado = r.employees as unknown as {
      full_name: string;
      work_centers: { name: string };
    };
    const ciclo = r.compliance_cycles as unknown as {
      name: string;
      traumatic_event_id: string | null;
      traumatic_events: { occurred_on: string } | null;
    };
    const esEvento = ciclo.traumatic_event_id !== null;
    return {
      nombreEmpleado: empleado.full_name,
      nombreCentro: empleado.work_centers.name,
      origen:
        esEvento && ciclo.traumatic_events
          ? `Acontecimiento traumático del ${fechaEsMx(ciclo.traumatic_events.occurred_on)}`
          : ciclo.name,
      esEventoTraumatico: esEvento,
      presentoAcontecimiento: r.presento_acontecimiento,
      requiereValoracion: r.requiere_valoracion,
      estatusCanalizacion: r.canalizacion_estatus,
      fechaCanalizacion: r.canalizacion_fecha,
    };
  });

  const contenido = csvRegistro58c(filas);
  const ok = await registrarAuditoriaEstricta(
    companyId,
    acceso.userId,
    'registro_58c_generado',
    'companies',
    companyId,
    { trabajadores: filas.length, sha256: sha256Hex(contenido) },
  );
  if (!ok) return { ok: false, error: AUDITORIA_FALLIDA };

  return { ok: true, nombre: 'registro-5-8-c-examinados.csv', contenido: base64(contenido) };
}
