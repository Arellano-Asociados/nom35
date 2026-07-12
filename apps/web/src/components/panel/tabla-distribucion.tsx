import type { Distribucion } from '@/lib/agregados';
import { NIVELES } from '@/lib/agregados';

const ETIQUETA: Record<string, string> = {
  nulo: 'Nulo',
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  muy_alto: 'Muy alto',
};

/** Tabla de distribución de niveles (conteos y %, NUNCA promedios; n<3 suprimido). */
export function TablaDistribucion({
  filas,
  testid,
}: {
  filas: { nombre: string; distribucion: Distribucion }[];
  testid?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid={testid}>
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-4"> </th>
            {NIVELES.map((nivel) => (
              <th key={nivel} className="py-2 pr-4">
                {ETIQUETA[nivel]}
              </th>
            ))}
            <th className="py-2">n</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ nombre, distribucion }) => (
            <tr key={nombre} className="border-b border-slate-100">
              <td className="py-2 pr-4 font-medium text-slate-900">{nombre}</td>
              {NIVELES.map((nivel) => {
                const celda = distribucion.celdas[nivel];
                return (
                  <td key={nivel} className="py-2 pr-4 text-slate-700">
                    {celda.suprimida ? (
                      <span title="Celda suprimida (n menor a 3)" className="text-slate-400">
                        &lt;3 *
                      </span>
                    ) : (
                      <>
                        {celda.n}
                        <span className="text-slate-400"> ({celda.porcentaje}%)</span>
                      </>
                    )}
                  </td>
                );
              })}
              <td className="py-2 text-slate-500">{distribucion.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        * Las celdas con menos de 3 personas se suprimen para impedir la reidentificación. Los
        agregados son conteos y porcentajes; nunca se promedian resultados entre personas.
      </p>
    </div>
  );
}
