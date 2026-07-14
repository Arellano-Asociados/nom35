'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ResultadoPanel } from '@/acciones/panel';
import { claseCampo } from '@/components/panel/campos';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Plantilla descargable (fila 4 de la tabla de copy de la auditoría v0): RH abre
// Excel, no "pega CSVs" — la plantilla enseña el formato con un ejemplo real.
const PLANTILLA_CSV = [
  'nombre,email,area,atiende_clientes,supervisa_personal',
  'Ana López,ana.lopez@empresa.mx,Ventas,si,no',
  'Juan Pérez,juan.perez@empresa.mx,Producción,no,si',
].join('\n');

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
      <p className="text-texto-secundario">
        Copia desde Excel las columnas <strong>Nombre, Correo, Área, ¿Atiende clientes?</strong> y{' '}
        <strong>¿Supervisa personal?</strong> (sí/no, separadas por comas), con una fila por
        persona, y pégalas abajo.{' '}
        <a
          download="plantilla-empleados.csv"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(PLANTILLA_CSV)}`}
          className="font-medium text-marca-700 underline hover:text-marca-800"
        >
          Descarga la plantilla
        </a>{' '}
        para ver el formato exacto.
      </p>
      <select
        aria-label="Centro de trabajo destino"
        value={centro}
        onChange={(e) => setCentro(e.target.value)}
        className={claseCampo}
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
        className={cn(claseCampo, 'font-mono text-xs')}
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
        {pendiente ? 'Procesando…' : 'Importar empleados'}
      </Button>
      {resultado?.error && (
        <p role="alert" className="text-peligro">
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
