'use server';

import { escrituraOk } from '@/lib/escrituras';
import { ipCliente, permitido } from '@/lib/limites';
import { clienteAdmin } from '@/lib/supabase-admin';
import { verificarTurnstile } from '@/lib/turnstile';

// Derechos ARCO (arts. 22-34 LFPDPPP) — no existía ningún mecanismo (auditoría v0).
// El titular es un trabajador SIN cuenta en la plataforma: su solicitud se recibe desde
// una página pública y la atiende la empresa responsable, con constancia en BD.
// El plazo legal de respuesta es de 20 días hábiles desde `created_at`.

export type TipoArco = 'acceso' | 'rectificacion' | 'cancelacion' | 'oposicion' | 'revocacion';

export interface ResultadoArco {
  ok: boolean;
  error?: string;
  folio?: string;
}

const TIPOS: TipoArco[] = ['acceso', 'rectificacion', 'cancelacion', 'oposicion', 'revocacion'];

export async function accionSolicitudArco(formData: FormData): Promise<ResultadoArco> {
  // Formulario público: límite por IP (Fase 2.5) + anti-bot. 5 solicitudes/hora
  // bastan para cualquier titular real y frenan el volcado automatizado.
  const ip = await ipCliente();
  if (!(await permitido(`arco:${ip}`, { ventanaSegundos: 3600, maximo: 5 }))) {
    return {
      ok: false,
      error: 'Recibimos demasiadas solicitudes desde tu conexión. Intenta de nuevo en una hora.',
    };
  }
  const bot = await verificarTurnstile(String(formData.get('cf-turnstile-response') ?? ''), ip);
  if (!bot.ok) {
    return { ok: false, error: bot.error };
  }

  const empresaNombre = String(formData.get('empresa') ?? '').trim();
  const tipo = String(formData.get('tipo') ?? '') as TipoArco;
  const nombre = String(formData.get('nombre') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const descripcion = String(formData.get('descripcion') ?? '').trim();

  if (!empresaNombre || !nombre || !email || !descripcion) {
    return { ok: false, error: 'Completa todos los campos para poder atender tu solicitud.' };
  }
  if (!TIPOS.includes(tipo)) {
    return { ok: false, error: 'Elige el derecho que quieres ejercer.' };
  }

  const supabase = clienteAdmin();
  // La solicitud se dirige a la empresa responsable: se busca por razón social exacta.
  const { data: empresa } = await supabase
    .from('companies')
    .select('id')
    .ilike('legal_name', empresaNombre)
    .maybeSingle();
  if (!empresa) {
    return {
      ok: false,
      error:
        'No encontramos una empresa con ese nombre. Escríbelo tal como aparece en el aviso de privacidad que te compartieron.',
    };
  }

  const guardada = await escrituraOk(
    'solicitud ARCO',
    supabase
      .from('arco_requests')
      .insert({
        company_id: empresa.id,
        tipo,
        nombre_solicitante: nombre,
        email_solicitante: email,
        descripcion,
      })
      .select('id')
      .single(),
  );
  if (!guardada.ok) {
    return { ok: false, error: 'No se pudo registrar tu solicitud. Intenta de nuevo.' };
  }

  const folio = (guardada.data as { id: string } | null)?.id ?? '';
  return { ok: true, folio };
}
