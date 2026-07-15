import { LogoConstata } from '@/components/marca/logo';

// Layout de las pantallas de acceso/activación/MFA del portal de plataforma: SIN guardia
// (autorizarPlataforma redirige hacia estas rutas; protegerlas aquí sería un ciclo).

export default function LayoutAccesoAdmin({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <LogoConstata />
        {children}
        <p className="text-center text-xs text-texto-secundario">
          Acceso exclusivo del equipo de operación de Constata.
        </p>
      </div>
    </div>
  );
}
