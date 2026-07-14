'use client';

import { useState, useTransition } from 'react';
import {
  accionConsultarFolio,
  accionEnviarQueja,
  type ResultadoConsultaFolio,
} from '@/acciones/buzon';
import { Button } from '@/components/ui/button';
import { CATEGORIAS_QUEJA, ESTADOS_QUEJA, TEXTO_QUEJA_MAX } from '@/lib/buzon';
import { cn } from '@/lib/utils';

// Flujo del trabajador en el buzón (8.1 b): presentar una queja (anónima o
// identificada, a SU elección explícita) o consultar el estado de un folio.
// El folio y la clave se muestran UNA sola vez tras enviar.

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(new Date(iso));
}

function FormularioQueja({ token }: { token: string }) {
  const [categoria, setCategoria] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [anonimo, setAnonimo] = useState<boolean | null>(null);
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recibo, setRecibo] = useState<{ folio: string; clave: string } | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (recibo) {
    return (
      <div
        data-testid="recibo-queja"
        className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"
      >
        <p className="font-semibold">Tu reporte fue recibido. Gracias por hablar.</p>
        <p>
          Guarda estos datos <strong>ahora</strong>: por tu confidencialidad no volverán a mostrarse
          ni se enviarán por correo.
        </p>
        <dl className="rounded-lg bg-white p-4 font-mono text-base">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Folio</dt>
            <dd data-testid="folio-queja" className="font-semibold">
              {recibo.folio}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Clave de consulta</dt>
            <dd data-testid="clave-queja" className="font-semibold">
              {recibo.clave}
            </dd>
          </div>
        </dl>
        <p>
          Con el folio y la clave puedes volver a esta página cuando quieras para consultar el
          estado de tu reporte.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await accionEnviarQueja(token, {
            categoria: categoria ?? '',
            texto,
            anonimo,
            nombre,
            contacto,
          });
          if (!r.ok) setError(r.error);
          else setRecibo({ folio: r.folio, clave: r.clave });
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-slate-900">¿Qué quieres reportar?</legend>
        {Object.entries(CATEGORIAS_QUEJA).map(([valor, etiqueta]) => (
          <label
            key={valor}
            className={cn(
              'cursor-pointer rounded-lg border p-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-marca-600',
              categoria === valor ? 'border-marca-600 bg-marca-50' : 'border-slate-300',
            )}
          >
            <input
              type="radio"
              name="categoria"
              value={valor}
              className="sr-only"
              checked={categoria === valor}
              onChange={() => setCategoria(valor)}
            />
            {etiqueta}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-900">Cuéntanos qué pasó</span>
        <span className="text-xs text-slate-500">
          Qué ocurrió, cuándo y dónde. No incluyas datos que no quieras compartir.
        </span>
        <textarea
          data-testid="texto-queja"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={TEXTO_QUEJA_MAX}
          rows={6}
          className="rounded-lg border border-slate-400 p-3 text-sm"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-slate-900">
          ¿Quieres identificarte? Tú decides: ambas opciones son válidas.
        </legend>
        <label
          className={cn(
            'cursor-pointer rounded-lg border p-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-marca-600',
            anonimo === true ? 'border-marca-600 bg-marca-50' : 'border-slate-300',
          )}
        >
          <input
            type="radio"
            name="identidad"
            className="sr-only"
            checked={anonimo === true}
            onChange={() => setAnonimo(true)}
          />
          <span className="font-medium">De forma anónima.</span> Nadie sabrá quién envió el reporte;
          el seguimiento será solo con tu folio.
        </label>
        <label
          className={cn(
            'cursor-pointer rounded-lg border p-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-marca-600',
            anonimo === false ? 'border-marca-600 bg-marca-50' : 'border-slate-300',
          )}
        >
          <input
            type="radio"
            name="identidad"
            className="sr-only"
            checked={anonimo === false}
            onChange={() => setAnonimo(false)}
          />
          <span className="font-medium">Con mis datos.</span> Solo los verá quien atienda el caso;
          permite darte seguimiento directo.
        </label>
      </fieldset>

      {anonimo === false && (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-900">Tu nombre</span>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="rounded-lg border border-slate-400 p-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-900">
              Cómo contactarte (opcional: correo o teléfono)
            </span>
            <input
              type="text"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              className="rounded-lg border border-slate-400 p-2 text-sm"
            />
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pendiente} data-testid="enviar-queja">
        {pendiente ? 'Enviando…' : 'Enviar reporte'}
      </Button>
    </form>
  );
}

function ConsultaFolio({ token }: { token: string }) {
  const [folio, setFolio] = useState('');
  const [clave, setClave] = useState('');
  const [resultado, setResultado] = useState<ResultadoConsultaFolio | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setResultado(await accionConsultarFolio(token, folio, clave));
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-900">Folio</span>
        <input
          type="text"
          data-testid="consulta-folio"
          value={folio}
          onChange={(e) => setFolio(e.target.value)}
          placeholder="QJ-XXXXXXXX"
          className="rounded-lg border border-slate-400 p-2 font-mono text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-900">Clave de consulta</span>
        <input
          type="text"
          data-testid="consulta-clave"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="rounded-lg border border-slate-400 p-2 font-mono text-sm"
        />
      </label>
      <Button type="submit" variant="secondary" disabled={pendiente} data-testid="consultar-folio">
        {pendiente ? 'Consultando…' : 'Consultar estado'}
      </Button>

      {resultado && !resultado.ok && (
        <p role="alert" className="text-sm text-peligro">
          {resultado.error}
        </p>
      )}
      {resultado?.ok && (
        <div
          data-testid="estado-queja"
          className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800"
        >
          <p>
            Estado actual:{' '}
            <strong>
              {ESTADOS_QUEJA[resultado.estado as keyof typeof ESTADOS_QUEJA] ?? resultado.estado}
            </strong>
          </p>
          <p>Recibida el {fechaCorta(resultado.recibidaEl)}.</p>
          {resultado.transiciones.length > 0 && (
            <ol className="flex flex-col gap-1 text-xs text-slate-600">
              {resultado.transiciones.map((t, i) => (
                <li key={i}>
                  {fechaCorta(t.fecha)}: pasó a{' '}
                  {ESTADOS_QUEJA[t.estado as keyof typeof ESTADOS_QUEJA] ?? t.estado}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </form>
  );
}

export function BuzonEmpleado({ token, razonSocial }: { token: string; razonSocial: string }) {
  const [vista, setVista] = useState<'enviar' | 'consultar'>('enviar');

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Buzón de quejas y denuncias</h1>
        <p className="text-sm text-slate-600">
          {razonSocial} · Canal seguro y confidencial para reportar actos de violencia laboral o
          prácticas que dañan el ambiente de trabajo (NOM-035). Nadie de tu empresa sabrá que
          entraste a esta página.
        </p>
      </header>
      <div role="tablist" aria-label="Opciones del buzón" className="flex gap-2">
        <button
          role="tab"
          aria-selected={vista === 'enviar'}
          data-testid="tab-enviar"
          onClick={() => setVista('enviar')}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium',
            vista === 'enviar' ? 'bg-marca-700 text-white' : 'bg-slate-100 text-slate-700',
          )}
        >
          Presentar un reporte
        </button>
        <button
          role="tab"
          aria-selected={vista === 'consultar'}
          data-testid="tab-consultar"
          onClick={() => setVista('consultar')}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium',
            vista === 'consultar' ? 'bg-marca-700 text-white' : 'bg-slate-100 text-slate-700',
          )}
        >
          Consultar un folio
        </button>
      </div>
      {vista === 'enviar' ? <FormularioQueja token={token} /> : <ConsultaFolio token={token} />}
    </div>
  );
}
