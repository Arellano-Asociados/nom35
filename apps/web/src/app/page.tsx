import Link from 'next/link';

export default function PaginaInicio() {
  return (
    <div className="flex flex-col gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Plataforma NOM-035</h1>
      <p className="text-sm leading-relaxed text-slate-600">
        Cumplimiento de la NOM-035-STPS-2018. Si recibiste una invitación para responder un
        cuestionario, usa el enlace de tu correo.
      </p>
      <p className="text-sm">
        <Link href="/ingresar" className="text-blue-700 underline hover:text-blue-800">
          Acceso administrativo
        </Link>
      </p>
    </div>
  );
}
