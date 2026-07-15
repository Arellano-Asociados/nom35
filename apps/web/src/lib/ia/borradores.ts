import { clienteAdmin } from '@/lib/supabase-admin';

// Vista de un borrador de IA para la UI (Fase 6 §7). Resuelve el email del adoptante para
// la leyenda de trazabilidad ("revisado y adoptado por {usuario}"). service_role: solo
// lee ai_drafts (ya gobernado por RLS para el que llama) y resuelve un email de auth,
// como lo hacen otras notificaciones del servidor. NO es la allow-list de datos de la IA
// (eso es ia-datos): aquí solo se lee texto ya generado y su metadata de adopción.

export type TipoBorrador = 'resumen_ejecutivo' | 'plan_accion';

export interface BorradorVista {
  id: string;
  tipo: TipoBorrador;
  texto: string;
  modelo: string;
  creadoEl: string;
  adoptado: boolean;
  adoptadoPor: string | null; // email del adoptante
  adoptadoEl: string | null;
}

/** El borrador MÁS RECIENTE del ciclo y tipo (o null). Solo el más reciente es adoptable. */
export async function ultimoBorrador(
  companyId: string,
  cycleId: string,
  tipo: TipoBorrador,
): Promise<BorradorVista | null> {
  const admin = clienteAdmin();
  const { data } = await admin
    .from('ai_drafts')
    .select('id, tipo, texto, modelo, created_at, adopted_by, adopted_at')
    .eq('company_id', companyId)
    .eq('cycle_id', cycleId)
    .eq('tipo', tipo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  let adoptadoPor: string | null = null;
  if (data.adopted_by) {
    const { data: usuario } = await admin.auth.admin.getUserById(data.adopted_by);
    adoptadoPor = usuario.user?.email ?? null;
  }

  return {
    id: data.id,
    tipo: data.tipo,
    texto: data.texto,
    modelo: data.modelo,
    creadoEl: data.created_at,
    adoptado: data.adopted_at !== null,
    adoptadoPor,
    adoptadoEl: data.adopted_at,
  };
}
