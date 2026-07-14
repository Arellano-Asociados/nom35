'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { escrituraOk } from '@/lib/escrituras';
import { TIPOS_PLANTILLA, type TipoPlantilla } from '@/lib/plantillas';
import { rutaDeObjeto, validarImagen } from '@/lib/subidas';
import { clienteAdmin } from '@/lib/supabase-admin';
import { clienteSesion } from '@/lib/supabase-servidor';

// Configuración de organización y plantillas (Fase 3). Escrituras con cliente de
// sesión (RLS); Storage con service_role (bucket privado) tras validar magic bytes.

export interface ResultadoConfiguracion {
  ok: boolean;
  error?: string;
}

const SIN_PERMISO =
  'Tu rol no permite esta acción. Pídele al Administrador de la organización que la realice o que te asigne el permiso.';

const ZONAS_VALIDAS = [
  'America/Mexico_City',
  'America/Tijuana',
  'America/Hermosillo',
  'America/Cancun',
  'UTC',
];

export async function accionGuardarConfiguracion(
  companyId: string,
  formData: FormData,
): Promise<void> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) redirect(`/panel/${companyId}`);
  const ruta = `/panel/${companyId}/configuracion`;

  const timezone = String(formData.get('timezone') ?? 'America/Mexico_City');
  if (!ZONAS_VALIDAS.includes(timezone)) redirect(`${ruta}?error=datos`);

  const guardado = await escrituraOk(
    'guardar configuración de organización',
    (await clienteSesion()).from('company_settings').upsert(
      {
        company_id: companyId,
        timezone,
        contacto_nombre: String(formData.get('contacto_nombre') ?? '').trim() || null,
        contacto_correo: String(formData.get('contacto_correo') ?? '').trim() || null,
        contacto_telefono: String(formData.get('contacto_telefono') ?? '').trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id' },
    ),
  );
  if (!guardado.ok) redirect(`${ruta}?error=crear`);
  revalidatePath(ruta);
  redirect(ruta);
}

export async function accionSubirLogo(companyId: string, formData: FormData): Promise<void> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) redirect(`/panel/${companyId}`);
  const ruta = `/panel/${companyId}/configuracion`;

  const archivo = formData.get('logo') as File | null;
  if (!archivo || archivo.size === 0) redirect(`${ruta}?error=datos`);

  const validado = await validarImagen(archivo);
  if (!validado.ok) redirect(`${ruta}?error=archivo`);

  // service_role SOLO para Storage (bucket privado); la fila con la sesión (RLS).
  const rutaArchivo = rutaDeObjeto(companyId, validado.archivo.extension);
  const { error: errorSubida } = await clienteAdmin()
    .storage.from('logos')
    .upload(rutaArchivo, validado.archivo.bytes, { contentType: validado.archivo.contentType });
  if (errorSubida) redirect(`${ruta}?error=subida`);

  const guardado = await escrituraOk(
    'guardar logo de la organización',
    (await clienteSesion())
      .from('company_settings')
      .upsert(
        { company_id: companyId, logo_path: rutaArchivo, updated_at: new Date().toISOString() },
        { onConflict: 'company_id' },
      ),
  );
  if (!guardado.ok) redirect(`${ruta}?error=subida`);
  revalidatePath(ruta);
  redirect(ruta);
}

export async function accionGuardarPlantilla(
  companyId: string,
  tipo: TipoPlantilla,
  asunto: string,
  cuerpo: string,
): Promise<ResultadoConfiguracion> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: SIN_PERMISO };
  if (!TIPOS_PLANTILLA.includes(tipo)) return { ok: false, error: 'Tipo de plantilla inválido' };
  if (!asunto.trim() || !cuerpo.trim()) {
    return { ok: false, error: 'El asunto y el cuerpo no pueden quedar vacíos.' };
  }

  const guardada = await escrituraOk(
    'guardar plantilla de correo',
    (await clienteSesion()).from('mail_templates').upsert(
      {
        company_id: companyId,
        tipo,
        asunto: asunto.trim(),
        cuerpo: cuerpo.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,tipo' },
    ),
  );
  if (!guardada.ok) return { ok: false, error: 'No se pudo guardar la plantilla.' };
  revalidatePath(`/panel/${companyId}/configuracion`);
  return { ok: true };
}

/** "Restaurar plantilla original" = borrar la fila: vuelve a aplicar la del código. */
export async function accionRestaurarPlantilla(
  companyId: string,
  tipo: TipoPlantilla,
): Promise<ResultadoConfiguracion> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) return { ok: false, error: SIN_PERMISO };

  const { error } = await (
    await clienteSesion()
  )
    .from('mail_templates')
    .delete()
    .eq('company_id', companyId)
    .eq('tipo', tipo);
  if (error) return { ok: false, error: 'No se pudo restaurar la plantilla.' };
  revalidatePath(`/panel/${companyId}/configuracion`);
  return { ok: true };
}
