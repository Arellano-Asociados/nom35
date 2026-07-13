import Link from 'next/link';
import { LogoConstata } from '@/components/marca/logo';

export default function PaginaInicio() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1>
        <LogoConstata tamano="grande" />
        <span className="sr-only">Constata</span>
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-slate-600">
        Cumplimiento de la NOM-035-STPS-2018 con evidencia que resiste inspecciones. Si recibiste
        una invitación para responder un cuestionario, usa el enlace de tu correo.
      </p>
      <Link
        href="/ingresar"
        className="text-sm font-medium text-marca-700 underline underline-offset-2 hover:text-marca-800"
      >
        Acceso administrativo
      </Link>
    </div>
  );
}
