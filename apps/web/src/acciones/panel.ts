'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { registrarAuditoria } from '@/lib/auditoria';
import { plantillaCorreo, proveedorCorreo } from '@/lib/correo';
import { fechaEsMx } from '@/lib/fechas';
import { permitido } from '@/lib/limites';
import { plantillaVigente, renderPlantilla } from '@/lib/plantillas';
import { enviarRecordatoriosDeCiclo } from '@/lib/recordatorios';
import { parsearCsvEmpleados } from '@/lib/csv-empleados';
import { escrituraOk } from '@/lib/escrituras';
import { rutaDeObjeto, validarPdf } from '@/lib/subidas';
import { clienteAdmin } from '@/lib/supabase-admin';
import { clienteSesion, usuarioActual } from '@/lib/supabase-servidor';
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

  // service_role legítimo (Fase 2.5): quien crea la empresa aún no tiene membresía,
  // así que ninguna política RLS puede autorizar este bootstrap (empresa + primer admin).
  const supabase = clienteAdmin();
  const { data: empresa, error } = await supabase
    .from('companies')
    .insert({ legal_name: razonSocial, rfc: rfc || null, privacy_notice_version: 'v1' })
    .select('id')
    .single();
  if (error || !empresa) redirect('/panel/nueva?error=crear');

  // Si esto falla, la empresa quedaría sin ningún miembro y su creador rebotaría a
  // /panel sin poder entrar: se aborta en vez de dejar un tenant huérfano.
  const membresia = await escrituraOk(
    'asignar admin de la empresa',
    supabase.from('role_assignments').insert({
      company_id: empresa.id,
      auth_user_id: usuario.id,
      role: 'admin_org',
    }),
  );
  if (!membresia.ok) redirect('/panel/nueva?error=crear');
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

  const centroCreado = await escrituraOk(
    'crear centro de trabajo',
    (await clienteSesion()).from('work_centers').insert({
      company_id: companyId,
      name: nombre,
      address: String(formData.get('direccion') ?? '').trim() || null,
      main_activity: String(formData.get('actividad') ?? '').trim() || null,
      headcount,
    }),
  );
  if (!centroCreado.ok) redirect(`${ruta}?error=crear`);
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

  const { error } = await (await clienteSesion()).from('employees').insert({
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
  if (!puedeGestionar(acceso.membresia))
    return {
      ok: false,
      error:
        'Tu rol no permite esta acción. Pídele al Administrador de la organización que la realice o que te asigne el permiso.',
    };

  const { validos, errores } = parsearCsvEmpleados(contenido);
  const detalle = errores.map((e) => `Línea ${e.linea}: ${e.error}`);

  const supabase = await clienteSesion();
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
      detalle.push(
        `${empleado.email}: no se pudo registrar (revisa el correo y el formato de la fila)`,
      );
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

  // La bitácora NO debe afirmar que hay RD designado si el UPDATE no ocurrió.
  const designado = await escrituraOk(
    'designar Responsable Designado',
    (await clienteSesion())
      .from('role_assignments')
      .update({ is_designated_responsible: true })
      .eq('company_id', companyId)
      .eq('auth_user_id', acceso.userId),
  );
  if (!designado.ok) {
    return { ok: false, error: 'No se pudo registrar la designación. Intenta de nuevo.' };
  }
  // Aviso a los DEMÁS admins (mini-fase 3, auditoría v0 §6 [Alto] "auto-designación
  // sin control"): la designación no se prohíbe —una empresa unipersonal del segmento
  // necesita poder designarse—, pero deja de ser silenciosa: bitácora (abajo, ya
  // existía) + correo a cada otro admin de la organización. Fire-and-forget: el
  // aviso no debe impedir la designación; la evidencia dura es la bitácora.
  try {
    const admin = clienteAdmin();
    const { data: otrosAdmins } = await admin
      .from('role_assignments')
      .select('auth_user_id')
      .eq('company_id', companyId)
      .eq('role', 'admin_org')
      .neq('auth_user_id', acceso.userId);
    const correos: string[] = [];
    for (const fila of otrosAdmins ?? []) {
      const { data } = await admin.auth.admin.getUserById(fila.auth_user_id);
      if (data.user?.email) correos.push(data.user.email);
    }
    if (correos.length > 0) {
      await proveedorCorreo().enviar({
        para: correos,
        asunto: 'Se designó un Responsable Designado en tu organización',
        html: plantillaCorreo({
          saludo: 'Aviso a los administradores:',
          parrafos: [
            `${acceso.email} asumió el rol de Responsable Designado de la organización. Ese rol puede consultar resultados individuales (cada consulta queda auditada).`,
            'Si no lo reconoces, revísalo en la sección Equipo del panel.',
          ],
        }),
      });
    }
  } catch {
    // El aviso es cortesía; la designación y su bitácora no dependen de él.
  }

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

  // service_role legítimo (Fase 2.5): localizar al usuario por correo requiere la API
  // de administración de Auth. El INSERT de la asignación, en cambio, va con la sesión.
  const admin = clienteAdmin();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const consultor = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!consultor) {
    return {
      ok: false,
      error:
        'Esa persona aún no tiene cuenta. Pídele que se registre con ese correo y que lo confirme; después vuelve a intentarlo.',
    };
  }

  // Anti-secuestro (auditoría v0): antes bastaba coincidir por correo. Con el registro
  // abierto y sin confirmación, un tercero podía adelantarse a registrar el correo del
  // despacho que la empresa iba a contratar y recibir el tenant completo (padrón,
  // agregados, informes) sin que la víctima se enterara. Ahora se exige que el correo
  // esté CONFIRMADO: quien no probó ser dueño del buzón no puede ser vinculado.
  if (!consultor.email_confirmed_at) {
    return {
      ok: false,
      error:
        'Esa cuenta aún no ha confirmado su correo. Pídele que abra el enlace de confirmación que recibió y vuelve a intentarlo.',
    };
  }

  const { error } = await (await clienteSesion()).from('consultant_assignments').insert({
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

  // Recordatorios automáticos cada N días (Fase 3); vacío = desactivado.
  const recordatorioDias = Number(formData.get('recordatorio_dias')) || null;
  const { data: ciclo, error: errorCiclo } = await (
    await clienteSesion()
  )
    .from('compliance_cycles')
    .insert({
      company_id: companyId,
      reminder_interval_days: recordatorioDias,
      work_center_id: centroId,
      name: nombre,
      date_start: inicio,
      date_end: String(formData.get('fin') ?? '') || null,
      evaluator_name: evaluador,
      evaluator_license: cedula,
    })
    .select('id')
    .single();
  // El error del insert ya no se descarta: si falló, se informa en vez de caer en el
  // redirect genérico sin distinguir "no se creó" de "se creó pero no se leyó".
  if (errorCiclo || !ciclo) redirect(`${ruta}?error=crear`);

  await registrarAuditoria(companyId, acceso.userId, 'ciclo_creado', 'compliance_cycles', ciclo.id);
  redirect(`/panel/${companyId}/ciclos/${ciclo.id}`);
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
  if (!puedeGestionar(acceso.membresia))
    return {
      ok: false,
      error:
        'Tu rol no permite esta acción. Pídele al Administrador de la organización que la realice o que te asigne el permiso.',
    };

  const supabase = clienteAdmin();
  const { data: ciclo } = await supabase
    .from('compliance_cycles')
    .select('id, work_center_id, work_centers (nom_category)')
    .eq('company_id', companyId)
    .eq('id', cicloId)
    .maybeSingle();
  if (!ciclo) return { ok: false, error: 'Ciclo no encontrado' };

  // service_role legítimo (Fase 2.5): esta acción genera y escribe token_hash (la
  // capacidad del empleado) y envía correos; el secreto no debe depender de la sesión.
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
  // Plantilla editable por la organización (Fase 3); sin fila, la original. El
  // render sustituye variables en texto plano y plantillaCorreo escapa TODO
  // (inyección desde CSV, hallazgo Bajo de la auditoría v0).
  const plantilla = await plantillaVigente(supabase, companyId, 'invitacion');
  let creadas = 0;
  let correosEnviados = 0;

  for (const empleado of empleados ?? []) {
    for (const guia of guias ?? []) {
      if (yaAsignados.has(`${empleado.id}:${guia.id}`)) continue;
      const token = generarToken();
      const vencimiento = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      const { error } = await supabase.from('questionnaire_assignments').insert({
        company_id: companyId,
        cycle_id: cicloId,
        employee_id: empleado.id,
        questionnaire_id: guia.id,
        token_hash: hashDeToken(token),
        expires_at: vencimiento.toISOString(),
      });
      if (error) continue;
      creadas++;
      try {
        const r = renderPlantilla(plantilla, {
          nombre: empleado.full_name,
          empresa: acceso.membresia.razonSocial,
          fecha_limite: fechaEsMx(vencimiento.toISOString()),
        });
        const [saludo, ...parrafos] = r.parrafos;
        await correo.enviar({
          para: [empleado.email],
          asunto: r.asunto,
          html: plantillaCorreo({
            saludo: saludo ?? `Hola ${empleado.full_name}:`,
            parrafos,
            cta: { url: `${base}/responder/${token}`, etiqueta: 'Responder cuestionario' },
          }),
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
  if (!puedeGestionar(acceso.membresia))
    return {
      ok: false,
      error:
        'Tu rol no permite esta acción. Pídele al Administrador de la organización que la realice o que te asigne el permiso.',
    };

  // Idempotencia práctica (mini-fase 3; auditoría v0 §6 [Medio] "recordatorios sin
  // límite ni idempotencia"): un doble clic o reintento dentro de la ventana no
  // vuelve a rotar tokens ni a mandar otra tanda de correos a toda la plantilla.
  if (!(await permitido(`recordatorios:${cicloId}`, { ventanaSegundos: 600, maximo: 1 }))) {
    return {
      ok: false,
      error:
        'Ya se enviaron recordatorios de este ciclo hace unos minutos. Espera 10 minutos antes de reenviar.',
    };
  }

  // Envío compartido con el cron de recordatorios automáticos (Fase 3): rota tokens,
  // usa la plantilla vigente y deja el evento en bitácora.
  const enviados = await enviarRecordatoriosDeCiclo({
    companyId,
    cicloId,
    razonSocial: acceso.membresia.razonSocial,
    actorUserId: acceso.userId,
  });
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

  // service_role legítimo (Fase 2.5): gr1_results no tiene GRANT para authenticated
  // (regla 5: datos de salud solo por la app). La guardia de RD está arriba y el
  // cambio queda auditado abajo.
  const { error } = await clienteAdmin()
    .from('gr1_results')
    .update({ canalizacion_estatus: estatus, canalizacion_fecha: fecha })
    .eq('company_id', companyId)
    .eq('id', gr1Id);
  if (error)
    return { ok: false, error: 'No se pudo guardar el cambio de canalización. Intenta de nuevo.' };
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

  const accionCreada = await escrituraOk(
    'registrar acción del Capítulo 8',
    (await clienteSesion()).from('action_items').insert({
      company_id: companyId,
      cycle_id: cicloId,
      description: descripcion,
      origin_level: nivel,
      responsible: responsable,
      due_date: String(formData.get('fecha') ?? '') || null,
    }),
  );
  if (!accionCreada.ok) redirect(`${ruta}?error=crear`);
  revalidatePath(ruta);
  redirect(ruta);
}

export async function accionActualizarAccion(
  companyId: string,
  accionId: string,
  estatus: 'pendiente' | 'en_progreso' | 'completada',
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia))
    return {
      ok: false,
      error:
        'Tu rol no permite esta acción. Pídele al Administrador de la organización que la realice o que te asigne el permiso.',
    };
  const estatusActualizado = await escrituraOk(
    'actualizar estatus de la acción',
    (await clienteSesion())
      .from('action_items')
      .update({ status: estatus })
      .eq('company_id', companyId)
      .eq('id', accionId),
  );
  if (!estatusActualizado.ok) {
    return { ok: false, error: 'No se pudo actualizar el estatus. Intenta de nuevo.' };
  }
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

  // El archivo se valida por sus BYTES (magic bytes de PDF), no por lo que declare el
  // cliente, y el nombre del objeto lo genera el servidor: antes se podía subir un .html
  // declarándolo text/html y servírselo a los trabajadores por URL firmada (XSS/phishing).
  const validado = await validarPdf(archivo);
  if (!validado.ok) redirect(`${ruta}?error=archivo`);

  // service_role legítimo (Fase 2.5) SOLO para Storage: los buckets son privados y no
  // tienen políticas de escritura para authenticated. La fila de la política se
  // inserta con la sesión (RLS).
  const rutaArchivo = rutaDeObjeto(companyId, validado.archivo.extension);
  const { error: errorSubida } = await clienteAdmin()
    .storage.from('politicas')
    .upload(rutaArchivo, validado.archivo.bytes, {
      contentType: validado.archivo.contentType,
    });
  if (errorSubida) redirect(`${ruta}?error=subida`);

  // Sin esta guarda, un insert fallido dejaba el PDF huérfano en Storage y la política
  // "publicada" no existía para acuses ni expediente — con redirect de éxito.
  const politicaCreada = await escrituraOk(
    'publicar política de prevención',
    (await clienteSesion()).from('policies').insert({
      company_id: companyId,
      title: titulo,
      version,
      storage_path: rutaArchivo,
    }),
  );
  if (!politicaCreada.ok) redirect(`${ruta}?error=subida`);
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

  // Mismas reglas que la política: la capacitación también se entrega a los empleados
  // por URL firmada, así que un archivo no-PDF aquí es el mismo vector de XSS/phishing.
  const validado = await validarPdf(archivo);
  if (!validado.ok) redirect(`${ruta}?error=archivo`);

  // Igual que la política: Storage con service_role (bucket privado), fila con sesión.
  const rutaArchivo = rutaDeObjeto(companyId, validado.archivo.extension);
  const { error } = await clienteAdmin()
    .storage.from('capacitacion')
    .upload(rutaArchivo, validado.archivo.bytes, {
      contentType: validado.archivo.contentType,
    });
  if (error) redirect(`${ruta}?error=subida`);

  const capacitacionCreada = await escrituraOk(
    'publicar contenido de capacitación',
    (await clienteSesion()).from('training_contents').insert({
      company_id: companyId,
      title: titulo,
      storage_path: rutaArchivo,
    }),
  );
  if (!capacitacionCreada.ok) redirect(`${ruta}?error=subida`);
  revalidatePath(ruta);
  redirect(ruta);
}

export async function accionRegistrarCapacitacion(
  companyId: string,
  trainingId: string,
  employeeIds: string[],
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia))
    return {
      ok: false,
      error:
        'Tu rol no permite esta acción. Pídele al Administrador de la organización que la realice o que te asigne el permiso.',
    };

  const supabase = await clienteSesion();
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
