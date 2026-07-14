import { accionGuardarConfiguracion, accionSubirLogo } from '@/acciones/configuracion';
import { EditorPlantillas } from '@/components/configuracion/editor-plantillas';
import { AvisoRolSinGestion } from '@/components/panel/aviso-rol';
import { ErrorFormulario } from '@/components/panel/error-formulario';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { claseControl, CampoSelect, CampoTexto } from '@/components/ui/input';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import type { Plantilla, TipoPlantilla } from '@/lib/plantillas';
import { clienteAdmin } from '@/lib/supabase-admin';
import { clienteSesion } from '@/lib/supabase-servidor';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ZONAS = [
  ['America/Mexico_City', 'Centro (Ciudad de México)'],
  ['America/Tijuana', 'Pacífico (Tijuana)'],
  ['America/Hermosillo', 'Sonora (Hermosillo)'],
  ['America/Cancun', 'Sureste (Cancún)'],
  ['UTC', 'UTC'],
] as const;

export default async function PaginaConfiguracion({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { empresa } = await params;
  const { error: errorFormulario } = await searchParams;
  const acceso = await autorizarEmpresa(empresa);
  if (!puedeGestionar(acceso.membresia)) return <AvisoRolSinGestion />;

  const supabase = await clienteSesion();
  const [{ data: settings }, { data: plantillas }] = await Promise.all([
    supabase
      .from('company_settings')
      .select('logo_path, timezone, contacto_nombre, contacto_correo, contacto_telefono')
      .eq('company_id', empresa)
      .maybeSingle(),
    supabase.from('mail_templates').select('tipo, asunto, cuerpo').eq('company_id', empresa),
  ]);

  // URL firmada corta para previsualizar el logo (bucket privado).
  let urlLogo: string | null = null;
  if (settings?.logo_path) {
    const { data } = await clienteAdmin()
      .storage.from('logos')
      .createSignedUrl(settings.logo_path, 60);
    urlLogo = data?.signedUrl ?? null;
  }

  const guardar = accionGuardarConfiguracion.bind(null, empresa);
  const subirLogo = accionSubirLogo.bind(null, empresa);
  const guardadas: Partial<Record<TipoPlantilla, Plantilla>> = {};
  for (const p of plantillas ?? []) {
    guardadas[p.tipo as TipoPlantilla] = { asunto: p.asunto, cuerpo: p.cuerpo };
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Identidad y datos de la organización</CardTitle>
            <p className="text-xs text-texto-secundario">
              El logo aparece junto a la marca Constata en los informes; la zona horaria aplica a
              las fechas de generación; el contacto se imprime en el informe.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={subirLogo} className="flex flex-col gap-3 text-sm">
              <ErrorFormulario codigo={errorFormulario} />
              {urlLogo && (
                /* URL firmada temporal de un bucket privado: <img> plano basta. */
                <img src={urlLogo} alt="Logo actual de la organización" className="h-12 w-fit" />
              )}
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Logo (PNG o JPG, máximo 2 MB)
                <input
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg"
                  required
                  className={cn(
                    claseControl,
                    'file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700',
                  )}
                />
              </label>
              <Button type="submit" variant="secondary">
                Subir logo
              </Button>
            </form>

            <form
              action={guardar}
              className="flex flex-col gap-3 border-t border-borde pt-4 text-sm"
            >
              <CampoSelect
                etiqueta="Zona horaria"
                nombre="timezone"
                defaultValue={settings?.timezone ?? 'America/Mexico_City'}
              >
                {ZONAS.map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </CampoSelect>
              <CampoTexto
                etiqueta="Contacto para reportes (nombre)"
                nombre="contacto_nombre"
                defaultValue={settings?.contacto_nombre ?? ''}
              />
              <CampoTexto
                etiqueta="Correo de contacto"
                nombre="contacto_correo"
                type="email"
                defaultValue={settings?.contacto_correo ?? ''}
              />
              <CampoTexto
                etiqueta="Teléfono de contacto"
                nombre="contacto_telefono"
                defaultValue={settings?.contacto_telefono ?? ''}
              />
              <Button type="submit">Guardar configuración</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plantillas de comunicación</CardTitle>
        </CardHeader>
        <CardContent>
          <EditorPlantillas companyId={empresa} guardadas={guardadas} />
        </CardContent>
      </Card>
    </div>
  );
}
