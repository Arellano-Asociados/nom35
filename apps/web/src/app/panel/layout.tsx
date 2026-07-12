import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/panel/sidebar';
import { usuarioActual } from '@/lib/supabase-servidor';

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/ingresar');

  return (
    <div className="min-h-screen">
      <Sidebar email={usuario.email ?? ''} />
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
