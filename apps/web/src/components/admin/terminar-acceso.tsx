'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPlataforma } from '@/acciones/plataforma';

export function TerminarAcceso({
  companyId,
  terminar,
}: {
  companyId: string;
  terminar: () => Promise<ResultadoPlataforma>;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  return (
    <button
      disabled={pendiente}
      data-testid="terminar-acceso"
      className="rounded-md border border-amber-400 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
      onClick={() =>
        startTransition(async () => {
          const r = await terminar();
          if (r.ok) {
            toast.success('Acceso de soporte terminado');
            router.push(`/admin/organizaciones/${companyId}`);
            router.refresh();
          } else {
            toast.error(r.error ?? 'No se pudo terminar el acceso');
          }
        })
      }
    >
      Terminar acceso
    </button>
  );
}
