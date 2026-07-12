import { accionCrearEmpresa } from '@/acciones/panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function PaginaNuevaEmpresa({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={accionCrearEmpresa} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Razón social
            <input
              name="razon_social"
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            RFC (opcional)
            <input name="rfc" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              No se pudo registrar la empresa. Revisa los datos.
            </p>
          )}
          <Button type="submit">Crear empresa</Button>
        </form>
      </CardContent>
    </Card>
  );
}
