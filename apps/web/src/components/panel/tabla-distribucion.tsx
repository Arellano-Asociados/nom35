import { BadgeNivel, BadgeSuprimido } from '@/components/panel/badges';
import type { Distribucion } from '@/lib/agregados';
import { NIVELES } from '@/lib/agregados';

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
          <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
            <th className="py-2 pr-4 font-medium"> </th>
            {NIVELES.map((nivel) => (
              <th key={nivel} className="py-2 pr-4 font-medium">
                <BadgeNivel nivel={nivel} />
              </th>
            ))}
            <th className="py-2 text-right font-medium">n</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ nombre, distribucion }) => (
            <tr key={nombre} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-2 pr-4 font-medium text-slate-900">{nombre}</td>
              {NIVELES.map((nivel) => {
                const celda = distribucion.celdas[nivel];
                return (
                  <td key={nivel} className="py-2 pr-4 text-right text-slate-700 tabular-nums">
                    {celda.suprimida ? (
                      <BadgeSuprimido texto="<3 *" />
                    ) : (
                      <>
                        {celda.n}
                        <span className="text-slate-400"> ({celda.porcentaje}%)</span>
                      </>
                    )}
                  </td>
                );
              })}
              <td className="py-2 text-right text-slate-500 tabular-nums">
                {distribucion.totalSuprimido ? <BadgeSuprimido texto="<3 *" /> : distribucion.total}
              </td>
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
