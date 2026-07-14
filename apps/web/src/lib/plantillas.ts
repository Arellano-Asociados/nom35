import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Plantillas de comunicación editables (Fase 3). El cuerpo es TEXTO PLANO con
 * variables {{nombre}}, {{empresa}}, {{fecha_limite}}; los párrafos se separan con
 * una línea en blanco. El escape de HTML es OBLIGATORIO y ocurre siempre en
 * `plantillaCorreo` (precedente: inyección por CSV) — ni la plantilla del cliente
 * ni los valores pueden meter HTML. El botón/CTA del correo NO es editable: el
 * enlace lo pone el sistema.
 *
 * Sin fila en mail_templates aplica la plantilla original ("restaurar" = borrar la
 * fila). Estos textos son los mismos que enviaba la Fase 2.
 */

export const TIPOS_PLANTILLA = ['invitacion', 'recordatorio', 'acuse'] as const;
export type TipoPlantilla = (typeof TIPOS_PLANTILLA)[number];

export interface Plantilla {
  asunto: string;
  cuerpo: string;
}

export const VARIABLES_PLANTILLA = ['nombre', 'empresa', 'fecha_limite'] as const;

export const PLANTILLAS_DEFAULT: Record<TipoPlantilla, Plantilla> = {
  invitacion: {
    asunto: 'Te invitamos a responder tu cuestionario NOM-035',
    cuerpo: [
      'Hola {{nombre}}:',
      '{{empresa}} está evaluando el entorno de trabajo conforme a la NOM-035. Responder toma entre 10 y 25 minutos, y puedes pausar cuando quieras: tus avances se guardan solos.',
      'Tus respuestas son confidenciales: nadie de tu empresa puede verlas.',
      'Tu enlace es personal y vence el {{fecha_limite}}.',
    ].join('\n\n'),
  },
  recordatorio: {
    asunto: 'Aún no has respondido tu cuestionario NOM-035',
    cuerpo: [
      'Hola {{nombre}}:',
      'Aún no has respondido tu cuestionario sobre el entorno de trabajo. Usa este nuevo enlace: los anteriores ya no funcionan.',
      'Tus respuestas son confidenciales: nadie de tu empresa puede verlas.',
      'El enlace vence el {{fecha_limite}}.',
    ].join('\n\n'),
  },
  acuse: {
    asunto: 'Recibimos tus respuestas',
    cuerpo: [
      'Hola {{nombre}}:',
      'Confirmamos que {{empresa}} recibió tu cuestionario completo. Gracias por tu participación.',
      'Este correo no incluye tus respuestas ni tus resultados: son confidenciales.',
    ].join('\n\n'),
  },
};

export interface PlantillaRenderizada {
  asunto: string;
  /** Párrafos de texto plano listos para `plantillaCorreo` (que escapa TODO). */
  parrafos: string[];
}

/** Sustituye solo variables conocidas; las desconocidas quedan visibles tal cual. */
export function renderPlantilla(
  plantilla: Plantilla,
  variables: Partial<Record<(typeof VARIABLES_PLANTILLA)[number], string>>,
): PlantillaRenderizada {
  const sustituir = (texto: string) =>
    texto.replace(/\{\{(\w+)\}\}/g, (original, nombre: string) => {
      const valor = (variables as Record<string, string | undefined>)[nombre];
      return valor !== undefined ? valor : original;
    });
  return {
    asunto: sustituir(plantilla.asunto),
    parrafos: sustituir(plantilla.cuerpo)
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
  };
}

/** Plantilla vigente de la empresa: la fila de BD o la original del código. */
export async function plantillaVigente(
  supabase: SupabaseClient,
  companyId: string,
  tipo: TipoPlantilla,
): Promise<Plantilla> {
  const { data } = await supabase
    .from('mail_templates')
    .select('asunto, cuerpo')
    .eq('company_id', companyId)
    .eq('tipo', tipo)
    .maybeSingle();
  if (data?.asunto && data?.cuerpo) return { asunto: data.asunto, cuerpo: data.cuerpo };
  return PLANTILLAS_DEFAULT[tipo];
}
