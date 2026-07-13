import { accionCrearEmpresa } from '@/acciones/panel';
import { claseCampo } from '@/components/panel/campos';
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
        <CardTitle>Registrar una empresa nueva</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={accionCrearEmpresa} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Razón social
            <input name="razon_social" required className={claseCampo} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            RFC (opcional)
            <input name="rfc" className={claseCampo} />
          </label>
          {error && (
            <p role="alert" className="text-sm text-peligro">
              No se pudo registrar la empresa. Revisa los datos.
            </p>
          )}
          <Button type="submit">Registrar empresa</Button>
        </form>
      </CardContent>
    </Card>
  );
}
