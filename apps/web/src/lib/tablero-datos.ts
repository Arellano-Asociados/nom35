import { distribucionNiveles, type Distribucion } from './agregados';
import { resultadosVigentesPorAsignacion } from './informe';
import { clienteAdmin } from './supabase-admin';

// Armado del semáforo agregado del dashboard (spec §1). service_role justificado: el rol
// patronal no tiene SELECT sobre risk_results — la agregación (distribuciones y conteos,
// jamás resultados individuales) ocurre aquí, en el servidor. Un SOLO lugar decide qué es
// "vigente" (resultadosVigentesPorAsignacion) y qué se suprime (agregados.ts): esta misma
// función alimenta el dashboard de ciclo, para que ambos coincidan siempre.

interface PuntuadoJson {
  nombre: string;
  nivel: string;
}

/** Un resultado vigente ya reducido a lo que el tablero necesita (sin datos individuales
 * más allá del centro y el área a los que pertenece). */
export interface VigenteTablero {
  nivelFinal: string;
  categorias: PuntuadoJson[];
  dominios: PuntuadoJson[];
  area: string;
  centro: string;
}

/**
 * Resultados VIGENTES del ciclo, con su centro y área. Compartido por el dashboard de
 * ciclo (que filtra por área) y el dashboard ejecutivo (que agrupa por centro). El único
 * lugar que lee risk_results para agregación.
 */
export async function vigentesDeCiclo(
  companyId: string,
  cycleId: string,
): Promise<VigenteTablero[]> {
  const { data } = await clienteAdmin()
    .from('risk_results')
    .select(
      'id, assignment_id, supersedes_id, created_at, nivel_final, categorias, dominios, employees (area, work_centers (name))',
    )
    .eq('company_id', companyId)
    .eq('cycle_id', cycleId);

  const vigentes = resultadosVigentesPorAsignacion(
    (data ?? []).map((r) => ({
      id: r.id,
      assignmentId: r.assignment_id,
      supersedesId: r.supersedes_id,
      createdAt: r.created_at,
      nivel_final: r.nivel_final,
      categorias: r.categorias,
      dominios: r.dominios,
      employees: r.employees,
    })),
  );

  return vigentes.map((r) => {
    const emp = r.employees as unknown as {
      area: string | null;
      work_centers: { name: string } | null;
    };
    return {
      nivelFinal: r.nivel_final as string,
      categorias: (r.categorias as PuntuadoJson[]) ?? [],
      dominios: (r.dominios as PuntuadoJson[]) ?? [],
      area: emp?.area ?? 'Sin área',
      centro: emp?.work_centers?.name ?? 'Sin centro',
    };
  });
}

/** Distribución de la calificación final (global), con supresión de fila completa. */
export function semaforoGlobal(vigentes: readonly VigenteTablero[]): Distribucion {
  return distribucionNiveles(vigentes.map((v) => v.nivelFinal));
}

/** Distribución de la calificación final por centro de trabajo (cada una suprimida por
 * separado: un centro chico sale enmascarado, no revela a nadie). */
export function semaforoPorCentro(
  vigentes: readonly VigenteTablero[],
): { centro: string; distribucion: Distribucion }[] {
  const porCentro = new Map<string, string[]>();
  for (const v of vigentes) {
    const lista = porCentro.get(v.centro) ?? [];
    lista.push(v.nivelFinal);
    porCentro.set(v.centro, lista);
  }
  return [...porCentro.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([centro, niveles]) => ({ centro, distribucion: distribucionNiveles(niveles) }));
}

/**
 * Número de canalizaciones GR-I ABIERTAS (estatus 'pendiente') del ciclo. Solo el CONTEO
 * (regla 5: el detalle de quién requiere valoración sigue siendo exclusivo del RD).
 * service_role: gr1_results no tiene GRANT para authenticated.
 */
export async function conteoCanalizacionesAbiertas(
  companyId: string,
  cycleId: string,
): Promise<number> {
  const { count } = await clienteAdmin()
    .from('gr1_results')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('cycle_id', cycleId)
    .eq('requiere_valoracion', true)
    .eq('canalizacion_estatus', 'pendiente');
  return count ?? 0;
}
