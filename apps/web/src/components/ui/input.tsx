import * as React from 'react';
import { cn } from '@/lib/utils';

/** Clase base de todo control de formulario (borde-control ≥3:1; foco global). */
export const claseControl =
  'w-full rounded-md border border-borde-control bg-superficie px-3 py-2 text-sm text-texto shadow-sm transition-colors placeholder:text-slate-400 hover:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50';

const claseControlError = 'border-peligro hover:border-peligro';

function idsDeCampo(nombre: string, error?: string, ayuda?: string) {
  const id = `campo-${nombre}`;
  const idError = error ? `${id}-error` : undefined;
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  return {
    id,
    idError,
    idAyuda,
    describedBy: [idError, idAyuda].filter(Boolean).join(' ') || undefined,
  };
}

function EnvolturaCampo({
  etiqueta,
  id,
  idError,
  idAyuda,
  error,
  ayuda,
  children,
}: {
  etiqueta: string;
  id: string;
  idError?: string;
  idAyuda?: string;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {etiqueta}
      </label>
      {children}
      {ayuda && (
        <p id={idAyuda} className="text-xs text-texto-secundario">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Campo de texto con etiqueta y error inline ligado por `aria-describedby` +
 * `aria-invalid` (WCAG 3.3.1/3.3.3; hallazgo Medio de accesibilidad de la auditoría
 * v0: los errores no estaban ligados al campo). Server-compatible: el id se deriva
 * del nombre, sin hooks.
 */
export function CampoTexto({
  etiqueta,
  nombre,
  error,
  ayuda,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  nombre: string;
  error?: string;
  ayuda?: string;
}) {
  const { id, idError, idAyuda, describedBy } = idsDeCampo(nombre, error, ayuda);
  return (
    <EnvolturaCampo {...{ etiqueta, id, idError, idAyuda, error, ayuda }}>
      <input
        id={id}
        name={nombre}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(claseControl, error && claseControlError, className)}
        {...props}
      />
    </EnvolturaCampo>
  );
}

/** Select con etiqueta y error inline; mismas garantías de accesibilidad que CampoTexto. */
export function CampoSelect({
  etiqueta,
  nombre,
  error,
  ayuda,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  etiqueta: string;
  nombre: string;
  error?: string;
  ayuda?: string;
}) {
  const { id, idError, idAyuda, describedBy } = idsDeCampo(nombre, error, ayuda);
  return (
    <EnvolturaCampo {...{ etiqueta, id, idError, idAyuda, error, ayuda }}>
      <select
        id={id}
        name={nombre}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(claseControl, error && claseControlError, className)}
        {...props}
      >
        {children}
      </select>
    </EnvolturaCampo>
  );
}
