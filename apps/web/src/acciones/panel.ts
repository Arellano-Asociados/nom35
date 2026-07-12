'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { registrarAuditoria } from '@/lib/auditoria';
import { proveedorCorreo } from '@/lib/correo';
import { parsearCsvEmpleados } from '@/lib/csv-empleados';
import { clienteAdmin } from '@/lib/supabase-admin';
import { usuarioActual } from '@/lib/supabase-servidor';
import { generarToken, hashDeToken } from '@/lib/tokens';

// Acciones del panel administrativo. TODAS verifican la membresía real del usuario en la
// empresa (autorizarEmpresa) antes de tocar datos; el id de empresa de la URL jamás se usa
// sin esa verificación (regla inviolable 6).

export interface ResultadoPanel {
  ok: boolean;
  error?: string;
  detalle?: string[];
}

// ─── Empresas ────────────────────────────────────────────────────────────────

export async function accionCrearEmpresa(formData: FormData): Promise<void> {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/ingresar');

  const razonSocial = String(formData.get('razon_social') ?? '').trim();
  const rfc = String(formData.get('rfc') ?? '').trim();
  if (razonSocial === '') redirect('/panel/nueva?error=razon');

  const supabase = clienteAdmin();
  const { data: empresa, error } = await supabase
    .from('companies')
    .insert({ legal_name: razonSocial, rfc: rfc || null, privacy_notice_version: 'v1' })
    .select('id')
    .single();
  if (error || !empresa) redirect('/panel/nueva?error=crear');

  await supabase.from('role_assignments').insert({
    company_id: empresa.id,
    auth_user_id: usuario.id,
    role: 'admin_org',
  });
  await registrarAuditoria(empresa.id, usuario.id, 'empresa_creada', 'companies', empresa.id);
  redirect(`/panel/${empresa.id}/centros`);
}

// ─── Centros de trabajo ──────────────────────────────────────────────────────

export async function accionCrearCentro(companyId: string, formData: FormData): Promise<void> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) redirect(`/panel/${companyId}`);

  const nombre = String(formData.get('nombre') ?? '').trim();
  const headcount = Number(formData.get('headcount'));
  const ruta = `/panel/${companyId}/centros`;
  if (nombre === '' || !Number.isInteger(headcount) || headcount < 1) {
    redirect(`${ruta}?error=datos`);
  }

  await clienteAdmin()
    .from('work_centers')
    .insert({
      company_id: companyId,
      name: nombre,
      address: String(formData.get('direccion') ?? '').trim() || null,
      main_activity: String(formData.get('actividad') ?? '').trim() || null,
      headcount,
    });
  revalidatePath(ruta);
  redirect(ruta);
}

// ─── Empleados ───────────────────────────────────────────────────────────────

export async function accionCrearEmpleado(companyId: string, formData: FormData): Promise<void> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) redirect(`/panel/${companyId}`);
  const ruta = `/panel/${companyId}/empleados`;

  const nombre = String(formData.get('nombre') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const centroId = String(formData.get('centro') ?? '');
  if (nombre === '' || email === '' || centroId === '') redirect(`${ruta}?error=datos`);

  const { error } = await clienteAdmin()
    .from('employees')
    .insert({
      company_id: companyId,
      work_center_id: centroId,
      full_name: nombre,
      email,
      area: String(formData.get('area') ?? '').trim() || null,
      attends_customers: formData.get('atiende') === 'si',
      supervises_others: formData.get('supervisa') === 'si',
    });
  if (error) redirect(`${ruta}?error=duplicado`);
  revalidatePath(ruta);
  redirect(ruta);
}

export async function accionImportarCsv(
  companyId: string,
  centroId: string,
  contenido: string,
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: 'Sin permisos' };

  const { validos, errores } = parsearCsvEmpleados(contenido);
  const detalle = errores.map((e) => `Línea ${e.linea}: ${e.error}`);

  const supabase = clienteAdmin();
  const { data: existentes } = await supabase
    .from('employees')
    .select('email')
    .eq('company_id', companyId);
  const emailsExistentes = new Set((existentes ?? []).map((e) => String(e.email).toLowerCase()));

  let insertados = 0;
  for (const empleado of validos) {
    if (emailsExistentes.has(empleado.email)) {
      detalle.push(`${empleado.email}: ya existe en la empresa`);
      continue;
    }
    const { error } = await supabase.from('employees').insert({
      company_id: companyId,
      work_center_id: centroId,
      full_name: empleado.nombre,
      email: empleado.email,
      area: empleado.area,
      attends_customers: empleado.atiendeClientes,
      supervises_others: empleado.supervisaPersonal,
    });
    if (error) {
      detalle.push(`${empleado.email}: ${error.message}`);
    } else {
      insertados++;
    }
  }
  await registrarAuditoria(
    companyId,
    acceso.userId,
    'empleados_importados',
    'employees',
    undefined,
    {
      insertados,
      errores: detalle.length,
    },
  );
  revalidatePath(`/panel/${companyId}/empleados`);
  return { ok: true, detalle: [`${insertados} empleados importados`, ...detalle] };
}

// ─── Equipo (RD y consultores) ───────────────────────────────────────────────

export async function accionDesignarmeRD(
  companyId: string,
  cedula: string,
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (acceso.membresia.rol !== 'admin_org')
    return { ok: false, error: 'Solo el Admin de Organización' };

  await clienteAdmin()
    .from('role_assignments')
    .update({ is_designated_responsible: true })
    .eq('company_id', companyId)
    .eq('auth_user_id', acceso.userId);
  await registrarAuditoria(
    companyId,
    acceso.userId,
    'rd_designado',
    'role_assignments',
    undefined,
    {
      cedula,
    },
  );
  revalidatePath(`/panel/${companyId}/equipo`);
  return { ok: true };
}

export async function accionAgregarConsultor(
  companyId: string,
  email: string,
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (acceso.membresia.rol !== 'admin_org')
    return { ok: false, error: 'Solo el Admin de Organización' };

  const supabase = clienteAdmin();
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const consultor = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!consultor) return { ok: false, error: 'No existe una cuenta con ese correo' };

  const { error } = await supabase.from('consultant_assignments').insert({
    company_id: companyId,
    consultant_user_id: consultor.id,
  });
  if (error) return { ok: false, error: 'Ese consultor ya está asignado' };
  await registrarAuditoria(
    companyId,
    acceso.userId,
    'consultor_asignado',
    'consultant_assignments',
  );
  revalidatePath(`/panel/${companyId}/equipo`);
  return { ok: true };
}

// ─── Ciclos y distribución ───────────────────────────────────────────────────

export async function accionCrearCiclo(companyId: string, formData: FormData): Promise<void> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) redirect(`/panel/${companyId}`);
  const ruta = `/panel/${companyId}/ciclos`;

  const centroId = String(formData.get('centro') ?? '');
  const nombre = String(formData.get('nombre') ?? '').trim();
  const inicio = String(formData.get('inicio') ?? '');
  const evaluador = String(formData.get('evaluador') ?? '').trim();
  const cedula = String(formData.get('cedula') ?? '').trim();
  if (!centroId || !nombre || !inicio || !evaluador || !cedula) redirect(`${ruta}?error=datos`);

  const { data: ciclo } = await clienteAdmin()
    .from('compliance_cycles')
    .insert({
      company_id: companyId,
      work_center_id: centroId,
      name: nombre,
      date_start: inicio,
      date_end: String(formData.get('fin') ?? '') || null,
      evaluator_name: evaluador,
      evaluator_license: cedula,
    })
    .select('id')
    .single();
  if (ciclo) {
    await registrarAuditoria(
      companyId,
      acceso.userId,
      'ciclo_creado',
      'compliance_cycles',
      ciclo.id,
    );
    redirect(`/panel/${companyId}/ciclos/${ciclo.id}`);
  }
  redirect(`${ruta}?error=crear`);
}

const GUIAS_POR_CATEGORIA: Record<string, string[]> = {
  solo_gr1: ['GR-I'],
  gr1_gr2: ['GR-I', 'GR-II'],
  gr1_gr3: ['GR-I', 'GR-III'],
};

/** Crea las asignaciones del ciclo (guías según la categoría normativa del centro) y envía
 * los enlaces tokenizados por correo. Idempotente: no duplica asignaciones existentes. */
export async function accionDistribuir(
  companyId: string,
  cicloId: string,
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: 'Sin permisos' };

  const supabase = clienteAdmin();
  const { data: ciclo } = await supabase
    .from('compliance_cycles')
    .select('id, work_center_id, work_centers (nom_category)')
    .eq('company_id', companyId)
    .eq('id', cicloId)
    .maybeSingle();
  if (!ciclo) return { ok: false, error: 'Ciclo no encontrado' };

  const categoria = (ciclo.work_centers as unknown as { nom_category: string }).nom_category;
  const codigos = GUIAS_POR_CATEGORIA[categoria] ?? ['GR-I'];

  const { data: guias } = await supabase
    .from('questionnaires')
    .select('id, code')
    .in('code', codigos);
  const { data: empleados } = await supabase
    .from('employees')
    .select('id, email, full_name')
    .eq('company_id', companyId)
    .eq('work_center_id', ciclo.work_center_id)
    .eq('active', true);
  const { data: existentes } = await supabase
    .from('questionnaire_assignments')
    .select('employee_id, questionnaire_id')
    .eq('cycle_id', cicloId);
  const yaAsignados = new Set(
    (existentes ?? []).map((a) => `${a.employee_id}:${a.questionnaire_id}`),
  );

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const correo = proveedorCorreo();
  let creadas = 0;
  let correosEnviados = 0;

  for (const empleado of empleados ?? []) {
    for (const guia of guias ?? []) {
      if (yaAsignados.has(`${empleado.id}:${guia.id}`)) continue;
      const token = generarToken();
      const { error } = await supabase.from('questionnaire_assignments').insert({
        company_id: companyId,
        cycle_id: cicloId,
        employee_id: empleado.id,
        questionnaire_id: guia.id,
        token_hash: hashDeToken(token),
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (error) continue;
      creadas++;
      try {
        await correo.enviar({
          para: [empleado.email],
          asunto: `Cuestionario NOM-035 (${guia.code})`,
          html: `<p>Hola ${empleado.full_name}:</p>
                 <p>Te invitamos a responder el cuestionario ${guia.code} de la NOM-035.
                 Tus respuestas son confidenciales: nadie de tu empresa puede verlas.</p>
                 <p><a href="${base}/responder/${token}">Responder cuestionario</a></p>`,
        });
        correosEnviados++;
      } catch {
        // El envío de correo no debe tirar la distribución; el enlace puede rotarse después
      }
    }
  }

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'ciclo_distribuido',
    'compliance_cycles',
    cicloId,
    {
      asignaciones_creadas: creadas,
      correos_enviados: correosEnviados,
    },
  );
  revalidatePath(`/panel/${companyId}/ciclos/${cicloId}`);
  return {
    ok: true,
    detalle: [`${creadas} asignaciones creadas`, `${correosEnviados} correos enviados`],
  };
}

/** Recordatorios a pendientes: rota el token de cada asignación pendiente y reenvía el enlace. */
export async function accionRecordatorios(
  companyId: string,
  cicloId: string,
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: 'Sin permisos' };

  const supabase = clienteAdmin();
  const { data: pendientes } = await supabase
    .from('questionnaire_assignments')
    .select('id, employee_id, employees (email, full_name), questionnaires (code)')
    .eq('company_id', companyId)
    .eq('cycle_id', cicloId)
    .is('completed_at', null);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const correo = proveedorCorreo();
  let enviados = 0;

  for (const asignacion of pendientes ?? []) {
    const token = generarToken();
    const { error } = await supabase
      .from('questionnaire_assignments')
      .update({
        token_hash: hashDeToken(token),
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', asignacion.id);
    if (error) continue;
    const empleado = asignacion.employees as unknown as { email: string; full_name: string };
    const guia = asignacion.questionnaires as unknown as { code: string };
    try {
      await correo.enviar({
        para: [empleado.email],
        asunto: `Recordatorio: cuestionario NOM-035 (${guia.code})`,
        html: `<p>Hola ${empleado.full_name}:</p>
               <p>Tienes pendiente el cuestionario ${guia.code}. Este enlace sustituye al anterior:</p>
               <p><a href="${base}/responder/${token}">Responder cuestionario</a></p>`,
      });
      enviados++;
    } catch {
      // sin interrumpir el resto
    }
  }

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'recordatorios_enviados',
    'compliance_cycles',
    cicloId,
    {
      enviados,
    },
  );
  return { ok: true, detalle: [`${enviados} recordatorios enviados`] };
}

// ─── Canalización GR-I (solo Responsable Designado) ─────────────────────────

export async function accionActualizarCanalizacion(
  companyId: string,
  gr1Id: string,
  estatus: 'pendiente' | 'canalizado' | 'atendido',
  fecha: string | null,
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (!acceso.membresia.esResponsableDesignado) {
    return { ok: false, error: 'Solo el Responsable Designado' };
  }

  const { error } = await clienteAdmin()
    .from('gr1_results')
    .update({ canalizacion_estatus: estatus, canalizacion_fecha: fecha })
    .eq('company_id', companyId)
    .eq('id', gr1Id);
  if (error) return { ok: false, error: 'No se pudo actualizar' };
  await registrarAuditoria(
    companyId,
    acceso.userId,
    'canalizacion_actualizada',
    'gr1_results',
    gr1Id,
    {
      estatus,
    },
  );
  revalidatePath(`/panel/${companyId}`);
  return { ok: true };
}

// ─── Acciones (Capítulo 8) ───────────────────────────────────────────────────

export async function accionCrearAccion(
  companyId: string,
  cicloId: string,
  formData: FormData,
): Promise<void> {
  const acceso = await autorizarEmpresa(companyId);
  const ruta = `/panel/${companyId}/ciclos/${cicloId}/acciones`;
  if (!puedeGestionar(acceso.membresia)) redirect(`/panel/${companyId}`);

  const descripcion = String(formData.get('descripcion') ?? '').trim();
  const nivel = String(formData.get('nivel') ?? '');
  const responsable = String(formData.get('responsable') ?? '').trim();
  if (!descripcion || !nivel || !responsable) redirect(`${ruta}?error=datos`);

  await clienteAdmin()
    .from('action_items')
    .insert({
      company_id: companyId,
      cycle_id: cicloId,
      description: descripcion,
      origin_level: nivel,
      responsible: responsable,
      due_date: String(formData.get('fecha') ?? '') || null,
    });
  revalidatePath(ruta);
  redirect(ruta);
}

export async function accionActualizarAccion(
  companyId: string,
  accionId: string,
  estatus: 'pendiente' | 'en_progreso' | 'completada',
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: 'Sin permisos' };
  await clienteAdmin()
    .from('action_items')
    .update({ status: estatus })
    .eq('company_id', companyId)
    .eq('id', accionId);
  revalidatePath(`/panel/${companyId}`);
  return { ok: true };
}

// ─── Política de prevención y capacitación ───────────────────────────────────

export async function accionSubirPolitica(companyId: string, formData: FormData): Promise<void> {
  const acceso = await autorizarEmpresa(companyId);
  const ruta = `/panel/${companyId}/politica`;
  if (!puedeGestionar(acceso.membresia)) redirect(`/panel/${companyId}`);

  const archivo = formData.get('archivo') as File | null;
  const titulo = String(formData.get('titulo') ?? '').trim();
  const version = String(formData.get('version') ?? '').trim();
  if (!archivo || archivo.size === 0 || !titulo || !version) redirect(`${ruta}?error=datos`);

  const supabase = clienteAdmin();
  const rutaArchivo = `${companyId}/${Date.now()}-${archivo.name}`;
  const { error: errorSubida } = await supabase.storage
    .from('politicas')
    .upload(rutaArchivo, archivo, { contentType: archivo.type || 'application/octet-stream' });
  if (errorSubida) redirect(`${ruta}?error=subida`);

  await supabase.from('policies').insert({
    company_id: companyId,
    title: titulo,
    version,
    storage_path: rutaArchivo,
  });
  await registrarAuditoria(companyId, acceso.userId, 'politica_publicada', 'policies');
  revalidatePath(ruta);
  redirect(ruta);
}

export async function accionSubirCapacitacion(
  companyId: string,
  formData: FormData,
): Promise<void> {
  const acceso = await autorizarEmpresa(companyId);
  const ruta = `/panel/${companyId}/capacitacion`;
  if (!puedeGestionar(acceso.membresia)) redirect(`/panel/${companyId}`);

  const archivo = formData.get('archivo') as File | null;
  const titulo = String(formData.get('titulo') ?? '').trim();
  if (!archivo || archivo.size === 0 || !titulo) redirect(`${ruta}?error=datos`);

  const supabase = clienteAdmin();
  const rutaArchivo = `${companyId}/${Date.now()}-${archivo.name}`;
  const { error } = await supabase.storage
    .from('capacitacion')
    .upload(rutaArchivo, archivo, { contentType: archivo.type || 'application/octet-stream' });
  if (error) redirect(`${ruta}?error=subida`);

  await supabase.from('training_contents').insert({
    company_id: companyId,
    title: titulo,
    storage_path: rutaArchivo,
  });
  revalidatePath(ruta);
  redirect(ruta);
}

export async function accionRegistrarCapacitacion(
  companyId: string,
  trainingId: string,
  employeeIds: string[],
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: 'Sin permisos' };

  const supabase = clienteAdmin();
  let registrados = 0;
  for (const employeeId of employeeIds) {
    const { error } = await supabase.from('training_records').insert({
      company_id: companyId,
      training_id: trainingId,
      employee_id: employeeId,
    });
    if (!error) registrados++;
  }
  revalidatePath(`/panel/${companyId}/capacitacion`);
  return { ok: true, detalle: [`${registrados} registros de capacitación`] };
}
