import { clienteSesion } from './supabase-servidor';

/**
 * Feature flags por organización (Fase 3). Se evalúan SIEMPRE en servidor con el
 * cliente de sesión (RLS: cualquier miembro lee los flags de su tenant; solo la
 * plataforma los escribe — service_role). Sin fila, aplica el default del código:
 * todo configurable tiene default sensato.
 */
export const FLAGS = {
  cuestionariosPersonalizados: 'cuestionarios_personalizados',
  /** Fase 6: resumen ejecutivo y plan de acción asistidos por IA (default OFF; el costo
   * por tenant lo gobierna este flag y un limitador fail-closed por ciclo). */
  iaAsistida: 'ia_asistida',
} as const;

export async function flagActiva(
  companyId: string,
  flag: string,
  defecto: boolean,
): Promise<boolean> {
  const supabase = await clienteSesion();
  const { data, error } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('company_id', companyId)
    .eq('flag', flag)
    .maybeSingle();
  if (error || !data) return defecto;
  return data.enabled === true;
}
