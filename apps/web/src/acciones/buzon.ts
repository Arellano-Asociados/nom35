'use server';

import { registrarAuditoria } from '@/lib/auditoria';
import { generarClave, generarFolio, validarQueja, type DatosQueja } from '@/lib/buzon';
import { proveedorCorreo, plantillaCorreo } from '@/lib/correo';
import { escrituraOk } from '@/lib/escrituras';
import { ipCliente, permitido } from '@/lib/limites';
import { ACTOR_SISTEMA } from '@/lib/recordatorios';
import { clienteAdmin } from '@/lib/supabase-admin';
import { hashDeToken } from '@/lib/tokens';

// Acciones del buzón de quejas (NOM-035 8.1 b). El flujo del trabajador corre sin
// sesión: el token del buzón (por EMPRESA, no por persona — el anonimato debe ser
// técnicamente cierto) es la capacidad, y se re-valida en cada acción. El contenido
// de una queja jamás viaja en correos ni a la bitácora (estándar de dato sensible).

export type ResultadoEnviarQueja =
  { ok: true; folio: string; clave: string } | { ok: false; error: string };

export type ResultadoConsultaFolio =
  | {
      ok: true;
      estado: string;
      recibidaEl: string;
      transiciones: { estado: string; fecha: string }[];
    }
  | { ok: false; error: string };

interface ContextoBuzon {
  companyId: string;
  razonSocial: string;
}

async function contextoBuzon(token: string): Promise<ContextoBuzon | { error: string }> {
  const { data } = await clienteAdmin()
    .from('complaint_boxes')
    .select('company_id, companies (legal_name)')
    .eq('token_hash', hashDeToken(token))
    .maybeSingle();
  if (!data) {
    // Adivinación de tokens del buzón: cuenta contra la IP igual que en /responder.
    const ip = await ipCliente();
    await permitido(`token-miss:${ip}`, { ventanaSegundos: 600, maximo: 30 });
    return { error: 'Enlace inválido' };
  }
  return {
    companyId: data.company_id,
    razonSocial: (data.companies as unknown as { legal_name: string }).legal_name,
  };
}

/** Aviso genérico a admins y RD: hay una queja nueva. SIN contenido ni categoría. */
async function avisarQuejaNueva(companyId: string, razonSocial: string): Promise<void> {
  const supabase = clienteAdmin();
  const { data: destinatarios } = await supabase
    .from('role_assignments')
    .select('auth_user_id, role, is_designated_responsible')
    .eq('company_id', companyId);

  const correos: string[] = [];
  for (const fila of destinatarios ?? []) {
    if (fila.role !== 'admin_org' && !fila.is_designated_responsible) continue;
    const { data } = await supabase.auth.admin.getUserById(fila.auth_user_id);
    if (data.user?.email) correos.push(data.user.email);
  }
  if (correos.length === 0) return;

  const base = process.env.NEXT_PUBLIC_APP_URL;
  await proveedorCorreo().enviar({
    para: correos,
    asunto: `Nueva queja en el buzón — ${razonSocial}`,
    html: plantillaCorreo({
      saludo: 'Aviso del buzón de quejas:',
      parrafos: [
        `Se recibió una nueva queja en el buzón de ${razonSocial}.`,
        'Por confidencialidad, este correo no incluye ningún detalle. Consulta el buzón en el panel; cada lectura queda registrada en la bitácora.',
      ],
      ...(base
        ? { cta: { etiqueta: 'Abrir el buzón', url: `${base}/panel/${companyId}/buzon` } }
        : {}),
    }),
  });
}

export async function accionEnviarQueja(
  token: string,
  datos: DatosQueja,
): Promise<ResultadoEnviarQueja> {
  const ctx = await contextoBuzon(token);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  // Anti-abuso: pocas quejas legítimas salen de una misma conexión en una hora.
  const ip = await ipCliente();
  if (!(await permitido(`buzon:${ip}`, { ventanaSegundos: 3600, maximo: 5 }))) {
    return {
      ok: false,
      error: 'Recibimos demasiados envíos desde tu conexión. Intenta de nuevo más tarde.',
    };
  }

  const validacion = validarQueja(datos);
  if (!validacion.ok) return { ok: false, error: validacion.error };

  const folio = generarFolio();
  const clave = generarClave();
  const identificada = datos.anonimo === false;

  const guardado = await escrituraOk(
    'recibir queja del buzón',
    clienteAdmin()
      .from('complaints')
      .insert({
        company_id: ctx.companyId,
        folio,
        folio_key_hash: hashDeToken(clave),
        category: datos.categoria,
        body: datos.texto.trim(),
        is_identified: identificada,
        contact_name: identificada ? datos.nombre.trim() : null,
        contact_info: identificada ? datos.contacto.trim() || null : null,
      }),
  );
  if (!guardado.ok) {
    return { ok: false, error: 'No se pudo registrar tu reporte. Intenta de nuevo.' };
  }

  // El evento NO lleva contenido (regla 9): solo el folio y la categoría.
  await registrarAuditoria(
    ctx.companyId,
    ACTOR_SISTEMA,
    'queja_recibida',
    'complaints',
    undefined,
    {
      folio,
      categoria: datos.categoria,
    },
  );
  await avisarQuejaNueva(ctx.companyId, ctx.razonSocial);

  return { ok: true, folio, clave };
}

export async function accionConsultarFolio(
  token: string,
  folio: string,
  clave: string,
): Promise<ResultadoConsultaFolio> {
  const ctx = await contextoBuzon(token);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const ip = await ipCliente();
  if (!(await permitido(`buzon-folio:${ip}`, { ventanaSegundos: 600, maximo: 30 }))) {
    return { ok: false, error: 'Demasiadas consultas. Espera unos minutos.' };
  }

  const supabase = clienteAdmin();
  const { data: queja } = await supabase
    .from('complaints')
    .select('id, status, created_at, folio_key_hash')
    .eq('company_id', ctx.companyId)
    .eq('folio', folio.trim().toUpperCase())
    .maybeSingle();
  // Mismo mensaje para folio inexistente y clave incorrecta: no se confirma la
  // existencia de un folio a quien no tiene la clave.
  if (!queja || queja.folio_key_hash !== hashDeToken(clave.trim().toUpperCase())) {
    return { ok: false, error: 'Folio o clave incorrectos.' };
  }

  // Solo METADATOS de seguimiento: el contenido no se re-muestra jamás (la clave
  // impresa en un papel no debe exponer el texto de la queja).
  const { data: eventos } = await supabase
    .from('complaint_events')
    .select('to_status, created_at')
    .eq('complaint_id', queja.id)
    .order('created_at', { ascending: true });

  return {
    ok: true,
    estado: queja.status,
    recibidaEl: queja.created_at,
    transiciones: (eventos ?? []).map((e) => ({ estado: e.to_status, fecha: e.created_at })),
  };
}
