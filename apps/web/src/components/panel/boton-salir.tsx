'use client';

import { useRouter } from 'next/navigation';
import { clienteNavegador } from '@/lib/supabase-navegador';

export function BotonSalir() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await clienteNavegador().auth.signOut();
        router.push('/ingresar');
        router.refresh();
      }}
      className="text-sm text-slate-600 underline hover:text-slate-900"
    >
      Salir
    </button>
  );
}
