import { Card, CardContent } from '@/components/ui/card';

/**
 * Aviso para el rol `miembro` (sin gestión) en páginas de gestión. Antes del
 * cliente de sesión (Fase 2.5), estas páginas se renderizaban con service_role y
 * un miembro veía TODO el tenant (hallazgo Medio de la dimensión 6 de la auditoría
 * v0); ahora la guardia es explícita y, debajo de ella, RLS de todos modos no le
 * entregaría las filas.
 */
export function AvisoRolSinGestion() {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-slate-700" data-testid="rol-sin-gestion">
        Tu rol no permite gestionar esta sección. Pídele al Administrador de la organización lo que
        necesites, o que te asigne un rol de gestión.
      </CardContent>
    </Card>
  );
}
