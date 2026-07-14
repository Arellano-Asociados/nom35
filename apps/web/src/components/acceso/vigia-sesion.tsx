'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { clienteNavegador } from '@/lib/supabase-navegador';

/**
 * Vigía de sesión del panel (mini-fase 3, caducidad de sesión). Con la pestaña
 * abierta, supabase-js refresca el token solo; la caducidad (timebox 7d /
 * inactividad 12h, config de Auth) se materializa cuando un refresh falla. Este
 * componente convierte ese momento en un aviso claro + regreso al login, en vez
 * de dejar el panel silenciosamente roto (formularios que fallan sin explicación).
 *
 * El flujo del empleado no usa sesión: su enlace es el token y cada respuesta se
 * guarda al momento — la caducidad jamás le tira respuestas capturadas.
 */
export function VigiaSesion() {
  const router = useRouter();

  useEffect(() => {
    const supabase = clienteNavegador();

    const alExpirar = () => {
      toast.warning('Tu sesión expiró. Vuelve a ingresar para continuar.', { duration: 8000 });
      router.push('/ingresar');
      router.refresh();
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') alExpirar();
    });

    // Red de seguridad: al volver a una pestaña dormida, el estado puede haber
    // caducado sin evento. Un sondeo barato al recuperar el foco lo detecta.
    const alVolver = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) alExpirar();
    };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [router]);

  return null;
}
