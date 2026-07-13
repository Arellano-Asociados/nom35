'use client';

import { useState, useTransition } from 'react';
import { accionSolicitudArco } from '@/acciones/arco';
import { Button } from '@/components/ui/button';

const DERECHOS = [
  {
    valor: 'acceso',
    titulo: 'Acceso',
    ayuda: 'Quiero saber qué datos míos tienen y cómo los usan.',
  },
  {
    valor: 'rectificacion',
    titulo: 'Rectificación',
    ayuda: 'Alguno de mis datos está equivocado y quiero corregirlo.',
  },
  {
    valor: 'cancelacion',
    titulo: 'Cancelación',
    ayuda: 'Quiero que eliminen mis datos.',
  },
  {
    valor: 'oposicion',
    titulo: 'Oposición',
    ayuda: 'No quiero que usen mis datos para un fin determinado.',
  },
  {
    valor: 'revocacion',
    titulo: 'Revocar mi consentimiento',
    ayuda: 'Ya no quiero que traten mis datos con base en el consentimiento que di.',
  },
];

const claseCampo =
  'rounded-md border border-slate-400 bg-white px-3 py-2 text-sm shadow-xs transition-colors hover:border-slate-500 focus-visible:border-marca-600';

export function FormularioArco() {
  const [enviando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [folio, setFolio] = useState<string | null>(null);

  if (folio) {
    return (
      <div
        role="status"
        data-testid="arco-recibida"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900"
      >
        <p className="font-medium">Recibimos tu solicitud.</p>
        <p className="mt-1">
          Tu folio es <span className="font-mono">{folio.slice(0, 8)}</span>. La empresa responsable
          debe responderte en un plazo máximo de <strong>20 días hábiles</strong>, contados desde
          hoy, al correo que nos diste.
        </p>
      </div>
    );
  }

  return (
    <form
      data-testid="formulario-arco"
      className="flex flex-col gap-4"
      action={(formData) =>
        iniciar(async () => {
          setError(null);
          const r = await accionSolicitudArco(formData);
          if (r.ok && r.folio) setFolio(r.folio);
          else setError(r.error ?? 'No se pudo registrar tu solicitud.');
        })
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-800">
          ¿Qué derecho quieres ejercer?
        </legend>
        {DERECHOS.map((d, i) => (
          <label
            key={d.valor}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-white p-3 text-sm transition-colors hover:bg-slate-50 has-checked:border-marca-700 has-checked:bg-marca-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-marca-500"
          >
            <input
              type="radio"
              name="tipo"
              value={d.valor}
              required
              defaultChecked={i === 0}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-slate-900">{d.titulo}</span>
              <span className="block text-slate-600">{d.ayuda}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
        Nombre de la empresa donde trabajas o trabajaste
        <input name="empresa" required className={claseCampo} />
        <span className="text-xs font-normal text-slate-600">
          Escríbelo tal como aparece en el aviso de privacidad que te compartieron.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
        Tu nombre completo
        <input name="nombre" required autoComplete="name" className={claseCampo} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
        Tu correo electrónico
        <input name="email" type="email" required autoComplete="email" className={claseCampo} />
        <span className="text-xs font-normal text-slate-600">
          A este correo te responderán. Usa uno al que tengas acceso.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
        Cuéntanos qué necesitas
        <textarea name="descripcion" required rows={4} className={claseCampo} />
      </label>

      {error && (
        <p role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}

      <Button type="submit" disabled={enviando} aria-busy={enviando}>
        {enviando ? 'Enviando…' : 'Enviar solicitud'}
      </Button>
    </form>
  );
}
