import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BotonSalir } from '@/components/panel/boton-salir';
import { usuarioActual } from '@/lib/supabase-servidor';

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/ingresar');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4">
        <Link href="/panel" className="text-lg font-semibold text-slate-900">
          Panel NOM-035
        </Link>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span data-testid="usuario-email">{usuario.email}</span>
          <BotonSalir />
        </div>
      </header>
      {children}
    </div>
  );
}
