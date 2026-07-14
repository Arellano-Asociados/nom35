'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { registrarAuditoria } from '@/lib/auditoria';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { escrituraOk } from '@/lib/escrituras';
import type { NivelAccion } from '@/lib/programa';
// service_role SOLO para Storage (bucket privado evidencias, patrón de política y
// capacitación): la fila de la acción se escribe como el usuario (RLS real).
import { clienteAdmin } from '@/lib/supabase-admin';
import { clienteSesion } from '@/lib/supabase-servidor';
import { rutaDeObjeto, validarImagen, validarPdf } from '@/lib/subidas';
import type { ResultadoPanel } from './panel';

// Acciones del Programa de intervención (NOM-035 8.3/8.4). El programa es un
// documento de trabajo: se edita como el usuario (RLS) y sus cambios quedan en la
// bitácora; la evidencia congelada es su exportación sellada en el expediente.

const SIN_PERMISOS =
  'Tu rol no permite esta acción. Pídele al Administrador de la organización que la realice o que te asigne el permiso.';

export interface AccionInicial {
  descripcion: string;
  nivelAccion: NivelAccion | null;
  nivelOrigen: string;
  fecha: string | null;
}

export async function accionCrearPrograma(
  companyId: string,
  cicloId: string,
  datos: {
    areas: string;
    responsable: string;
    acciones: AccionInicial[];
  },
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: SIN_PERMISOS };

  const areas = datos.areas.trim();
  const responsable = datos.responsable.trim();
  if (!areas || !responsable) {
    return {
      ok: false,
      error: 'El programa necesita las áreas o trabajadores sujetos y un responsable (8.4).',
    };
  }

  const supabase = await clienteSesion();
  const { data: creado, error } = await supabase
    .from('intervention_programs')
    .insert({
      company_id: companyId,
      cycle_id: cicloId,
      scope_areas: areas,
      responsible: responsable,
      created_by: acceso.userId,
    })
    .select('id')
    .single();
  if (error || !creado) {
    return {
      ok: false,
      error: 'No se pudo crear el programa (¿ya existe uno para este ciclo?). Recarga la página.',
    };
  }

  const NIVELES_VALIDOS = ['nulo', 'bajo', 'medio', 'alto', 'muy_alto'];
  const filas = datos.acciones
    .filter((a) => a.descripcion.trim().length > 0)
    .map((a) => ({
      company_id: companyId,
      cycle_id: cicloId,
      program_id: creado.id,
      description: a.descripcion.trim(),
      origin_level: NIVELES_VALIDOS.includes(a.nivelOrigen) ? a.nivelOrigen : 'medio',
      action_level: a.nivelAccion,
      responsible: responsable,
      due_date: a.fecha || null,
      target_areas: areas,
    }));
  if (filas.length > 0) {
    const accionesCreadas = await escrituraOk(
      'acciones iniciales del programa',
      supabase.from('action_items').insert(filas),
    );
    if (!accionesCreadas.ok) {
      return {
        ok: false,
        error: 'El programa se creó pero sus acciones no. Regístralas manualmente.',
      };
    }
  }

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'programa_creado',
    'intervention_programs',
    creado.id,
    { cicloId, acciones: filas.length },
  );
  revalidatePath(`/panel/${companyId}/ciclos/${cicloId}/acciones`);
  return { ok: true, detalle: [`Programa creado con ${filas.length} acciones iniciales.`] };
}

/** Form action clásica (patrón redirect + ?error=): la página lee searchParams. */
export async function accionActualizarPrograma(
  companyId: string,
  cicloId: string,
  programaId: string,
  formData: FormData,
): Promise<void> {
  const acceso = await autorizarEmpresa(companyId);
  const ruta = `/panel/${companyId}/ciclos/${cicloId}/acciones`;
  if (!puedeGestionar(acceso.membresia)) redirect(`/panel/${companyId}`);

  const areas = String(formData.get('areas') ?? '').trim();
  const responsable = String(formData.get('responsable') ?? '').trim();
  const evaluacion = String(formData.get('evaluacion') ?? '').trim();
  const fechaEvaluacion = String(formData.get('fecha_evaluacion') ?? '');
  if (!areas || !responsable) redirect(`${ruta}?error=datos`);

  const actualizado = await escrituraOk(
    'actualizar programa de intervención',
    (await clienteSesion())
      .from('intervention_programs')
      .update({
        scope_areas: areas,
        responsible: responsable,
        post_evaluation: evaluacion || null,
        post_evaluation_date: fechaEvaluacion || null,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('id', programaId),
  );
  if (!actualizado.ok) redirect(`${ruta}?error=crear`);

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'programa_actualizado',
    'intervention_programs',
    programaId,
  );
  revalidatePath(ruta);
  redirect(ruta);
}

/** Evidencia de avance de una acción (8.4 d): PDF o imagen validados por magic bytes. */
export async function accionSubirEvidenciaAccion(
  companyId: string,
  accionId: string,
  formData: FormData,
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: SIN_PERMISOS };

  const archivo = formData.get('archivo') as File | null;
  if (!archivo || archivo.size === 0) {
    return { ok: false, error: 'Elige un archivo PDF o una imagen (PNG/JPG).' };
  }

  // PDF o imagen: la verdad la dan los magic bytes, no el cliente.
  const comoPdf = await validarPdf(archivo);
  const comoImagen = comoPdf.ok ? null : await validarImagen(archivo);
  const valido = comoPdf.ok ? comoPdf.archivo : comoImagen?.ok ? comoImagen.archivo : null;
  if (!valido) {
    return { ok: false, error: 'Solo se aceptan PDF o imágenes PNG/JPG (máximo 10 MB / 2 MB).' };
  }

  // La acción debe ser del tenant (doble filtro) antes de tocar Storage.
  const supabase = await clienteSesion();
  const { data: accion } = await supabase
    .from('action_items')
    .select('id, cycle_id')
    .eq('company_id', companyId)
    .eq('id', accionId)
    .maybeSingle();
  if (!accion) return { ok: false, error: 'Acción no encontrada' };

  const ruta = rutaDeObjeto(companyId, valido.extension);
  const { error: errorSubida } = await clienteAdmin()
    .storage.from('evidencias')
    .upload(ruta, valido.bytes, { contentType: valido.contentType });
  if (errorSubida) return { ok: false, error: 'No se pudo subir la evidencia. Intenta de nuevo.' };

  const sha256 = createHash('sha256').update(valido.bytes).digest('hex');
  const filaActualizada = await escrituraOk(
    'registrar evidencia de la acción',
    supabase
      .from('action_items')
      .update({ evidence_path: ruta, evidence_sha256: sha256 })
      .eq('company_id', companyId)
      .eq('id', accionId),
  );
  if (!filaActualizada.ok) {
    return { ok: false, error: 'La evidencia se subió pero no se pudo ligar a la acción.' };
  }

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'evidencia_accion_subida',
    'action_items',
    accionId,
    { sha256 },
  );
  revalidatePath(`/panel/${companyId}/ciclos/${accion.cycle_id}/acciones`);
  return { ok: true, detalle: ['Evidencia adjuntada (huella de integridad registrada).'] };
}
