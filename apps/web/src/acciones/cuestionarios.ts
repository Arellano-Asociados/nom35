'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { registrarAuditoria } from '@/lib/auditoria';
import { autorizarEmpresa, empresaOperable, puedeGestionar } from '@/lib/autorizacion';
import { plantillaCorreo, proveedorCorreo } from '@/lib/correo';
import { validarDefinicion, type DefinicionCuestionario } from '@/lib/cuestionarios';
import { sha256DeDefinicion } from '@/lib/cuestionarios-sello';
import { escrituraOk } from '@/lib/escrituras';
import { fechaEsMx } from '@/lib/fechas';
import { permitido } from '@/lib/limites';
import { clienteAdmin } from '@/lib/supabase-admin';
import { clienteSesion } from '@/lib/supabase-servidor';
import { generarToken, hashDeToken } from '@/lib/tokens';

// Acciones de cuestionarios personalizados (Fase 3). Todas con cliente de SESIÓN
// (RLS real); el trigger de BD garantiza además que un publicado es inmutable
// aunque la app tuviera un bug. Las guías oficiales NO pasan por aquí.

export interface ResultadoCuestionario {
  ok: boolean;
  error?: string;
  id?: string;
  detalle?: string[];
}

const SIN_PERMISO =
  'Tu rol no permite esta acción. Pídele al Administrador de la organización que la realice o que te asigne el permiso.';

export async function accionCrearCuestionario(
  companyId: string,
  formData: FormData,
): Promise<void> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) redirect(`/panel/${companyId}`);
  const ruta = `/panel/${companyId}/cuestionarios`;

  const titulo = String(formData.get('titulo') ?? '').trim();
  if (!titulo) redirect(`${ruta}?error=datos`);

  const creado = await escrituraOk(
    'crear cuestionario personalizado',
    (await clienteSesion())
      .from('custom_questionnaires')
      .insert({ company_id: companyId, title: titulo })
      .select('id')
      .single(),
  );
  if (!creado.ok) redirect(`${ruta}?error=crear`);
  const id = (creado.data as unknown as { id: string }).id;
  redirect(`${ruta}/${id}`);
}

export async function accionGuardarBorrador(
  companyId: string,
  id: string,
  titulo: string,
  definition: DefinicionCuestionario,
): Promise<ResultadoCuestionario> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: SIN_PERMISO };
  if (!titulo.trim()) return { ok: false, error: 'El cuestionario necesita un título.' };

  // Validación laxa de forma (los borradores pueden estar a medias, pero el shape
  // debe ser el del dominio: nada de contenido arbitrario en la BD).
  if (!definition || !Array.isArray(definition.secciones)) {
    return { ok: false, error: 'La definición del cuestionario no es válida.' };
  }

  const guardado = await escrituraOk(
    'guardar borrador del cuestionario',
    (await clienteSesion())
      .from('custom_questionnaires')
      .update({ title: titulo.trim(), definition })
      .eq('company_id', companyId)
      .eq('id', id)
      .eq('status', 'borrador'),
  );
  if (!guardado.ok) {
    return { ok: false, error: 'No se pudo guardar el borrador. Intenta de nuevo.' };
  }
  revalidatePath(`/panel/${companyId}/cuestionarios/${id}`);
  return { ok: true };
}

export async function accionPublicarCuestionario(
  companyId: string,
  id: string,
): Promise<ResultadoCuestionario> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: SIN_PERMISO };

  const supabase = await clienteSesion();
  const { data: fila } = await supabase
    .from('custom_questionnaires')
    .select('id, title, status, definition')
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle();
  if (!fila) return { ok: false, error: 'Cuestionario no encontrado' };
  if (fila.status !== 'borrador') {
    return { ok: false, error: 'Solo un borrador puede publicarse.' };
  }

  const definicion = fila.definition as DefinicionCuestionario;
  const validacion = validarDefinicion(definicion);
  if (!validacion.ok) {
    return { ok: false, error: 'Corrige antes de publicar:', detalle: validacion.errores };
  }

  // Publicar = sellar: sha256 de la definición canónica. Desde aquí, inmutable
  // (trigger de BD); cualquier cambio será una nueva versión.
  const sello = sha256DeDefinicion(definicion);
  const publicado = await escrituraOk(
    'publicar cuestionario',
    supabase
      .from('custom_questionnaires')
      .update({ status: 'publicado', sha256: sello, published_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('id', id)
      .eq('status', 'borrador'),
  );
  if (!publicado.ok) return { ok: false, error: 'No se pudo publicar. Intenta de nuevo.' };

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'cuestionario_publicado',
    'custom_questionnaires',
    id,
    {
      sha256: sello,
    },
  );
  revalidatePath(`/panel/${companyId}/cuestionarios/${id}`);
  return { ok: true };
}

export async function accionArchivarCuestionario(
  companyId: string,
  id: string,
): Promise<ResultadoCuestionario> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: SIN_PERMISO };

  const archivado = await escrituraOk(
    'archivar cuestionario',
    (await clienteSesion())
      .from('custom_questionnaires')
      .update({ status: 'archivado' })
      .eq('company_id', companyId)
      .eq('id', id)
      .eq('status', 'publicado'),
  );
  if (!archivado.ok) return { ok: false, error: 'No se pudo archivar. Intenta de nuevo.' };
  await registrarAuditoria(
    companyId,
    acceso.userId,
    'cuestionario_archivado',
    'custom_questionnaires',
    id,
  );
  revalidatePath(`/panel/${companyId}/cuestionarios/${id}`);
  return { ok: true };
}

/** Nueva versión: fila nueva de la misma familia, version+1, en borrador, copiando la definición. */
export async function accionNuevaVersion(
  companyId: string,
  id: string,
): Promise<ResultadoCuestionario> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: SIN_PERMISO };

  const supabase = await clienteSesion();
  const { data: fila } = await supabase
    .from('custom_questionnaires')
    .select('familia_id, version, title, definition, status')
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle();
  if (!fila) return { ok: false, error: 'Cuestionario no encontrado' };
  if (fila.status === 'borrador') {
    return { ok: false, error: 'Este cuestionario aún es un borrador: edítalo directamente.' };
  }

  const { data: ultima } = await supabase
    .from('custom_questionnaires')
    .select('version')
    .eq('company_id', companyId)
    .eq('familia_id', fila.familia_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const creada = await escrituraOk(
    'crear nueva versión del cuestionario',
    supabase
      .from('custom_questionnaires')
      .insert({
        company_id: companyId,
        familia_id: fila.familia_id,
        version: (ultima?.version ?? fila.version) + 1,
        title: fila.title,
        definition: fila.definition,
      })
      .select('id')
      .single(),
  );
  if (!creada.ok) return { ok: false, error: 'No se pudo crear la nueva versión.' };
  return { ok: true, id: (creada.data as unknown as { id: string }).id };
}

/** Distribuye un cuestionario PUBLICADO a los empleados activos de la empresa. */
export async function accionDistribuirCuestionario(
  companyId: string,
  id: string,
): Promise<ResultadoCuestionario> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: SIN_PERMISO };
  // Fase 5: distribución con service_role — guardia de suspensión en capa app.
  const operable = empresaOperable(acceso.membresia);
  if (!operable.ok) return { ok: false, error: operable.error };

  if (!(await permitido(`distribuir-cp:${id}`, { ventanaSegundos: 600, maximo: 1 }))) {
    return {
      ok: false,
      error: 'Este cuestionario se distribuyó hace unos minutos. Espera 10 minutos.',
    };
  }

  const sesion = await clienteSesion();
  const { data: cuestionario } = await sesion
    .from('custom_questionnaires')
    .select('id, title, status')
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle();
  if (!cuestionario) return { ok: false, error: 'Cuestionario no encontrado' };
  if (cuestionario.status !== 'publicado') {
    return { ok: false, error: 'Solo un cuestionario publicado puede distribuirse.' };
  }

  const { data: empleados } = await sesion
    .from('employees')
    .select('id, email, full_name')
    .eq('company_id', companyId)
    .eq('active', true);

  // service_role legítimo: escribe token_hash (la capacidad del empleado) y consulta
  // asignaciones existentes para idempotencia; los correos salen con la plantilla.
  const admin = clienteAdmin();
  const { data: existentes } = await admin
    .from('custom_assignments')
    .select('employee_id')
    .eq('questionnaire_id', id);
  const yaAsignados = new Set((existentes ?? []).map((a) => a.employee_id));

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const correo = proveedorCorreo();
  let creadas = 0;
  let enviados = 0;

  for (const empleado of empleados ?? []) {
    if (yaAsignados.has(empleado.id)) continue;
    const token = generarToken();
    const vencimiento = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const { error } = await admin.from('custom_assignments').insert({
      company_id: companyId,
      questionnaire_id: id,
      employee_id: empleado.id,
      token_hash: hashDeToken(token),
      expires_at: vencimiento.toISOString(),
    });
    if (error) continue;
    creadas++;
    try {
      await correo.enviar({
        para: [empleado.email],
        asunto: `Tu empresa te invita a responder: ${cuestionario.title}`,
        html: plantillaCorreo({
          saludo: `Hola ${empleado.full_name}:`,
          parrafos: [
            `Tu empresa te invita a responder el cuestionario «${cuestionario.title}».`,
            'Tus respuestas se guardan solas y puedes pausar cuando quieras.',
            `Tu enlace es personal y vence el ${fechaEsMx(vencimiento.toISOString())}.`,
          ],
          cta: { url: `${base}/encuesta/${token}`, etiqueta: 'Responder' },
        }),
      });
      enviados++;
    } catch {
      // El correo no debe tirar la distribución.
    }
  }

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'cuestionario_distribuido',
    'custom_questionnaires',
    id,
    {
      asignaciones_creadas: creadas,
      correos_enviados: enviados,
    },
  );
  revalidatePath(`/panel/${companyId}/cuestionarios/${id}`);
  return { ok: true, detalle: [`${creadas} asignaciones creadas`, `${enviados} correos enviados`] };
}
