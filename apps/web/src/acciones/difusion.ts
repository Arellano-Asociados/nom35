'use server';

import { revalidatePath } from 'next/cache';
import { registrarAuditoria } from '@/lib/auditoria';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { armarResumenDifusion, sellarResumen } from '@/lib/difusion';
import { armarEntradaDifusionDesdeBd } from '@/lib/difusion-datos';
import { escrituraOk } from '@/lib/escrituras';
import { permitido } from '@/lib/limites';
import { clienteSesion } from '@/lib/supabase-servidor';
import type { ResultadoPanel } from './panel';

// Publicación de la constancia de difusión de resultados (NOM-035 5.7 e / 7.8).
// La escritura corre como el USUARIO (RLS real, Fase 2.5): dissemination_records
// exige gestión y published_by = auth.uid(). La agregación previa usa el módulo
// justificado lib/difusion-datos.ts.

export async function accionPublicarDifusion(
  companyId: string,
  cicloId: string,
): Promise<ResultadoPanel> {
  const acceso = await autorizarEmpresa(companyId);
  if (!puedeGestionar(acceso.membresia)) {
    return {
      ok: false,
      error:
        'Tu rol no permite esta acción. Pídele al Administrador de la organización que la realice o que te asigne el permiso.',
    };
  }

  // Idempotencia práctica: un doble clic no archiva dos constancias idénticas.
  if (!(await permitido(`difusion:${cicloId}`, { ventanaSegundos: 300, maximo: 1 }))) {
    return {
      ok: false,
      error: 'La constancia se publicó hace unos minutos. Revisa el historial o espera 5 minutos.',
    };
  }

  const armado = await armarEntradaDifusionDesdeBd(companyId, cicloId);
  if (!armado.ok) return { ok: false, error: armado.error };
  if (armado.entrada.participacion.completados === 0) {
    return { ok: false, error: 'Aún no hay resultados que difundir en este ciclo.' };
  }

  const resumen = armarResumenDifusion(armado.entrada);
  const { sha256 } = sellarResumen(resumen);

  const supabase = await clienteSesion();
  const { data: ultima } = await supabase
    .from('dissemination_records')
    .select('version')
    .eq('company_id', companyId)
    .eq('cycle_id', cicloId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (ultima?.version ?? 0) + 1;

  const guardado = await escrituraOk(
    'publicar constancia de difusión',
    supabase.from('dissemination_records').insert({
      company_id: companyId,
      cycle_id: cicloId,
      version,
      summary: resumen,
      sha256,
      published_by: acceso.userId,
    }),
  );
  if (!guardado.ok) {
    return { ok: false, error: 'No se pudo publicar la constancia. Intenta de nuevo.' };
  }

  await registrarAuditoria(
    companyId,
    acceso.userId,
    'difusion_publicada',
    'dissemination_records',
    undefined,
    { cicloId, version, sha256 },
  );

  revalidatePath(`/panel/${companyId}/ciclos/${cicloId}/difusion`);
  return { ok: true, detalle: [`Constancia publicada (versión ${version})`] };
}
