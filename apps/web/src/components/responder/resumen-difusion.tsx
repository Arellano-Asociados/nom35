import { TablaDistribucion } from '@/components/panel/tabla-distribucion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ResumenDifusion } from '@/lib/difusion';

// Render compartido de la constancia de difusión (5.7 e / 7.8): lo usa el flujo del
// empleado Y la vista previa/historial del panel — lo que el admin previsualiza es
// EXACTAMENTE lo que el trabajador ve. El resumen llega ya suprimido y sellado; este
// componente solo presenta.

/** Valida en runtime que el jsonb persistido tiene la forma del esquema 1. */
export function esResumenDifusion(valor: unknown): valor is ResumenDifusion {
  if (!valor || typeof valor !== 'object') return false;
  const v = valor as Record<string, unknown>;
  return v.esquema === 1 && Array.isArray(v.parrafos) && typeof v.distribucionGlobal === 'object';
}

export function ResumenDifusionVista({ resumen }: { resumen: ResumenDifusion }) {
  return (
    <Card data-testid="resumen-difusion">
      <CardHeader>
        <CardTitle>Resultados generales de tu centro de trabajo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm leading-relaxed text-slate-700">
        {resumen.parrafos.map((parrafo, i) => (
          <p key={i}>{parrafo}</p>
        ))}
        <TablaDistribucion
          testid="difusion-global"
          filas={[{ nombre: 'Resultado general', distribucion: resumen.distribucionGlobal }]}
        />
        {resumen.distribucionPorCategoria.length > 0 && (
          <TablaDistribucion
            testid="difusion-categorias"
            filas={resumen.distribucionPorCategoria.map((c) => ({
              nombre: c.nombre,
              distribucion: c.distribucion,
            }))}
          />
        )}
        {resumen.urlBuzon && (
          <p>
            Buzón de quejas y denuncias de tu empresa:{' '}
            <a
              href={resumen.urlBuzon}
              className="text-marca-700 underline"
              target="_blank"
              rel="noreferrer"
            >
              presentar una queja de forma confidencial
            </a>
            .
          </p>
        )}
        <p className="text-xs text-slate-500">{resumen.notaConfidencialidad}</p>
      </CardContent>
    </Card>
  );
}
