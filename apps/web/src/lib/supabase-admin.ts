import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// SOLO SERVIDOR. El service_role salta RLS: este cliente jamás debe importarse desde
// componentes de cliente. El flujo del empleado funciona por capacidad (token del enlace),
// validada en cada acción de servidor.

let cliente: SupabaseClient | undefined;

export function clienteAdmin(): SupabaseClient {
  if (!cliente) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !llave) {
      throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno');
    }
    cliente = createClient(url, llave, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cliente;
}
