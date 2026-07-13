import Link from 'next/link';
import { FormularioAcceso } from '@/components/acceso/formulario-acceso';
import { LogoConstata } from '@/components/marca/logo';

const ARGUMENTOS = [
  {
    titulo: 'Evidencia inmutable',
    detalle:
      'Las respuestas y los resultados no pueden editarse jamás; cada acceso a datos sensibles queda en la bitácora.',
  },
  {
    titulo: 'Cálculo oficial',
    detalle:
      'Las matrices de las Guías de Referencia del DOF, sin promedios: el mismo semáforo que revisa un inspector.',
  },
  {
    titulo: 'Expediente descargable',
    detalle:
      'Informe y expediente de inspección en un clic, con huella de integridad (SHA-256) por archivo.',
  },
] as const;

export default function PaginaIngresar() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel de propuesta de valor: es la primera pantalla que ve un prospecto. */}
      <section className="hidden flex-col justify-between gap-10 bg-marca-900 p-10 lg:flex">
        <LogoConstata claro />
        <div className="flex max-w-md flex-col gap-8">
          <p className="text-3xl leading-snug font-semibold tracking-tight text-white">
            Cumplimiento NOM-035 con evidencia que resiste inspecciones
          </p>
          <ul className="flex flex-col gap-5">
            {ARGUMENTOS.map(({ titulo, detalle }) => (
              <li key={titulo} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-marca-700 text-xs font-bold text-white"
                >
                  ✓
                </span>
                <p className="text-sm leading-relaxed text-marca-100">
                  <span className="font-semibold text-white">{titulo}.</span> {detalle}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-marca-300">
          NOM-035-STPS-2018 · Factores de riesgo psicosocial en el trabajo
        </p>
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="lg:hidden">
            <LogoConstata />
          </div>
          <FormularioAcceso />
          <p className="text-center text-xs text-texto-secundario">
            Al usar Constata aceptas el tratamiento descrito en el{' '}
            <Link href="/privacidad" className="text-marca-700 underline hover:text-marca-800">
              aviso de privacidad
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
