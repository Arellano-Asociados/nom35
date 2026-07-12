'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPanel } from '@/acciones/panel';
import { Button } from '@/components/ui/button';

export function ImportadorCsv({
  importar,
  centros,
}: {
  importar: (centroId: string, contenido: string) => Promise<ResultadoPanel>;
  centros: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [centro, setCentro] = useState(centros[0]?.id ?? '');
  const [contenido, setContenido] = useState('');
  const [resultado, setResultado] = useState<ResultadoPanel | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-slate-600">
        Formato: <code>nombre,email,area,atiende_clientes,supervisa_personal</code> (banderas
        si/no). Pega el contenido del CSV:
      </p>
      <select
        aria-label="Centro de trabajo destino"
        value={centro}
        onChange={(e) => setCentro(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2"
      >
        {centros.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <textarea
        aria-label="Contenido CSV"
        data-testid="csv-contenido"
        value={contenido}
        onChange={(e) => setContenido(e.target.value)}
        rows={6}
        className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
      />
      <Button
        disabled={pendiente || contenido.trim() === '' || centro === ''}
        data-testid="importar-csv"
        onClick={() =>
          startTransition(async () => {
            const r = await importar(centro, contenido);
            setResultado(r);
            if (r.ok) {
              toast.success(r.detalle?.[0] ?? 'Empleados importados');
              router.refresh();
            } else {
              toast.error(r.error ?? 'No se pudo importar el CSV');
            }
          })
        }
      >
        {pendiente ? 'Importando…' : 'Importar CSV'}
      </Button>
      {resultado?.error && (
        <p role="alert" className="text-red-700">
          {resultado.error}
        </p>
      )}
      {resultado?.detalle && (
        <ul data-testid="csv-reporte" className="rounded-md bg-slate-50 p-3 text-slate-700">
          {resultado.detalle.map((linea, i) => (
            <li key={i}>{linea}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
