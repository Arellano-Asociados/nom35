import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        No encontramos esta página
      </h1>
      <p className="text-sm leading-relaxed text-slate-600">
        Es posible que el enlace esté incompleto o que ya no exista.
      </p>
      <p className="text-sm">
        <Link href="/panel" className="text-blue-700 underline hover:text-blue-800">
          Volver al panel
        </Link>
      </p>
    </main>
  );
}
