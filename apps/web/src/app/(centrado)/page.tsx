import Link from 'next/link';

export default function PaginaInicio() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Plataforma NOM-035</h1>
      <p className="max-w-md text-sm leading-relaxed text-slate-600">
        Cumplimiento de la NOM-035-STPS-2018. Si recibiste una invitación para responder un
        cuestionario, usa el enlace de tu correo.
      </p>
      <Link
        href="/ingresar"
        className="text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
      >
        Acceso administrativo
      </Link>
    </div>
  );
}
