import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Tabs } from '@/components/ui/tabs';
import { autorizarEmpresa } from '@/lib/autorizacion';
import { clienteSesion } from '@/lib/supabase-servidor';

// Las pestañas del ciclo viven en ESTE layout compartido: antes existían solo en la
// página raíz del ciclo, así que desde cualquier subsección no había forma de saltar
// a otra ni señal de cuál estaba activa (auditoría v0, dimensión 1 [Alto] y
// dimensión 4 [Medio]). Las migas resuelven la orientación a 5 niveles de
// profundidad (dimensión 4 [Alto]: sin breadcrumbs).
export default async function LayoutCiclo({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ empresa: string; ciclo: string }>;
}) {
  const { empresa, ciclo } = await params;
  await autorizarEmpresa(empresa);

  const supabase = await clienteSesion();
  const { data: datosCiclo } = await supabase
    .from('compliance_cycles')
    .select('id, name, work_centers (name)')
    .eq('company_id', empresa)
    .eq('id', ciclo)
    .maybeSingle();
  if (!datosCiclo) notFound();
  const centro = (datosCiclo.work_centers as unknown as { name: string }).name;

  const base = `/panel/${empresa}/ciclos/${ciclo}`;
  const PESTANAS = [
    { href: base, etiqueta: 'Resumen', exacta: true },
    { href: `${base}/dashboard`, etiqueta: 'Dashboard agregado' },
    { href: `${base}/acciones`, etiqueta: 'Programa de intervención' },
    { href: `${base}/gr1`, etiqueta: 'Canalizaciones' },
    { href: `${base}/individual`, etiqueta: 'Resultados individuales' },
    { href: `${base}/difusion`, etiqueta: 'Difusión' },
    { href: `${base}/informes`, etiqueta: 'Informes y expediente' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        elementos={[
          { etiqueta: 'Ciclos', href: `/panel/${empresa}/ciclos` },
          { etiqueta: datosCiclo.name },
        ]}
      />
      <h2 className="text-xl font-semibold tracking-tight text-texto">
        {datosCiclo.name} · {centro}
      </h2>
      <Tabs pestanas={PESTANAS} ariaLabel="Secciones del ciclo" />
      {children}
    </div>
  );
}
