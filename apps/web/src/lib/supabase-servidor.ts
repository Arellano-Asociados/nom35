import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Cliente Supabase de servidor ligado a la sesión del usuario (cookies). */
export async function clienteSesion() {
  const almacenCookies = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => almacenCookies.getAll(),
      setAll: (nuevas) => {
        try {
          for (const { name, value, options } of nuevas) {
            almacenCookies.set(name, value, options);
          }
        } catch {
          // En Server Components no se pueden escribir cookies; el middleware las refresca.
        }
      },
    },
  });
}

export async function usuarioActual() {
  const supabase = await clienteSesion();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
