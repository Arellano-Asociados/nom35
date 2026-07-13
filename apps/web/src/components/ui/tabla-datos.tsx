'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { claseControl } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ColumnaTabla<T> {
  clave: keyof T & string;
  titulo: string;
  alinear?: 'derecha';
  /** Columna ordenable al clic en el encabezado (asc ⇄ desc). */
  ordenable?: boolean;
  /** Render propio de la celda; sin él se imprime el valor crudo. */
  render?: (fila: T) => ReactNode;
}

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Tabla de datos con búsqueda, orden y paginación en cliente (auditoría v0,
 * dimensión 1 [Medio]: la lista de empleados era una caja de scroll inmanejable para
 * el segmento objetivo de 101–500 empleados). Pensada para conjuntos de hasta unos
 * miles de filas ya cargadas por el servidor; la búsqueda ignora acentos.
 */
export function TablaDatos<T extends Record<string, string | number | null | undefined>>({
  columnas,
  filas,
  etiquetaBusqueda,
  tamanoPagina = 20,
  testid,
  vacio,
}: {
  columnas: ColumnaTabla<T>[];
  filas: T[];
  /** Si se da, se muestra el buscador con este placeholder. */
  etiquetaBusqueda?: string;
  tamanoPagina?: number;
  testid?: string;
  /** Contenido cuando no hay filas (tras filtrar o de origen). */
  vacio: ReactNode;
}) {
  const [consulta, setConsulta] = useState('');
  const [orden, setOrden] = useState<{ clave: string; desc: boolean } | null>(null);
  const [pagina, setPagina] = useState(0);

  const filtradas = useMemo(() => {
    if (!consulta.trim()) return filas;
    const aguja = normalizar(consulta);
    return filas.filter((fila) =>
      columnas.some((columna) => normalizar(fila[columna.clave]).includes(aguja)),
    );
  }, [filas, columnas, consulta]);

  const ordenadas = useMemo(() => {
    if (!orden) return filtradas;
    const factor = orden.desc ? -1 : 1;
    return [...filtradas].sort((a, b) => {
      const va = a[orden.clave];
      const vb = b[orden.clave];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
      return normalizar(va).localeCompare(normalizar(vb), 'es') * factor;
    });
  }, [filtradas, orden]);

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / tamanoPagina));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = ordenadas.slice(
    paginaActual * tamanoPagina,
    paginaActual * tamanoPagina + tamanoPagina,
  );

  const alternarOrden = (clave: string) =>
    setOrden((previo) =>
      previo?.clave === clave ? { clave, desc: !previo.desc } : { clave, desc: false },
    );

  return (
    <div className="flex flex-col gap-3" data-testid={testid}>
      {etiquetaBusqueda && (
        <label className="flex flex-col gap-1">
          <span className="sr-only">{etiquetaBusqueda}</span>
          <input
            type="search"
            placeholder={etiquetaBusqueda}
            value={consulta}
            onChange={(evento) => {
              setConsulta(evento.target.value);
              setPagina(0);
            }}
            className={cn(claseControl, 'max-w-sm')}
          />
        </label>
      )}

      {visibles.length === 0 ? (
        vacio
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs tracking-wide text-texto-terciario uppercase">
                {columnas.map((columna) => (
                  <th
                    key={columna.clave}
                    scope="col"
                    aria-sort={
                      orden?.clave === columna.clave
                        ? orden.desc
                          ? 'descending'
                          : 'ascending'
                        : undefined
                    }
                    className={cn(
                      'py-2 font-medium',
                      columna.alinear === 'derecha' && 'text-right',
                    )}
                  >
                    {columna.ordenable ? (
                      <button
                        type="button"
                        onClick={() => alternarOrden(columna.clave)}
                        className="inline-flex items-center gap-1 uppercase hover:text-texto"
                      >
                        {columna.titulo}
                        <span aria-hidden="true">
                          {orden?.clave === columna.clave ? (orden.desc ? '↓' : '↑') : '↕'}
                        </span>
                      </button>
                    ) : (
                      columna.titulo
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  {columnas.map((columna) => (
                    <td
                      key={columna.clave}
                      className={cn(
                        'py-2 pr-3 text-slate-700',
                        columna.alinear === 'derecha' && 'pr-0 text-right tabular-nums',
                      )}
                    >
                      {columna.render ? columna.render(fila) : (fila[columna.clave] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-texto-secundario">
          <span className="tabular-nums">
            {paginaActual * tamanoPagina + 1}–
            {Math.min((paginaActual + 1) * tamanoPagina, ordenadas.length)} de {ordenadas.length}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={paginaActual === 0}
              onClick={() => setPagina(paginaActual - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={paginaActual >= totalPaginas - 1}
              onClick={() => setPagina(paginaActual + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
