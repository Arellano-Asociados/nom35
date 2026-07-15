import { distribucionPorNombre, type Distribucion } from '../agregados';
import { selloCanonico } from '../cuestionarios-sello';
import type { CriteriosTomaAcciones } from '../programa';
import { clienteAdmin } from '../supabase-admin';
import { semaforoGlobal, semaforoPorCentro, vigentesDeCiclo } from '../tablero-datos';

// ALLOW-LIST de la IA (spec §2). Lo ÚNICO que la IA recibe es lo que este módulo arma.
// Cada consulta selecciona columnas explícitas y TODO dato de resultados pasa por
// agregados.ts (supresión de fila completa <3) ANTES de entrar al insumo: la IA ve
// exactamente lo que un admin ve en su dashboard, nada más.
//
// PROHIBIDO en el insumo, por construcción (no por sanitización): responses,
// risk_results/gr1_results crudos o por persona, registros 5.8, contenido del buzón (ni
// conteos), nombres/correos de EMPLEADOS, tokens, texto libre de quejas/eventos/notas.
//
// Los únicos strings de origen tenant (razón social, nombres de centros) se truncan a
// LIMITE_TEXTO y viajan como VALORES de campos JSON — jamás interpolados en instrucciones
// (anti prompt-injection estructural; ver lib/ia/proveedor.ts).

const LIMITE_TEXTO = 120;

function truncar(texto: string): string {
  return texto.length > LIMITE_TEXTO ? `${texto.slice(0, LIMITE_TEXTO)}…` : texto;
}

/** Una distribución reducida a lo mínimo que la IA necesita: conteo por nivel con su
 * marca de supresión, jamás el detalle individual. */
interface DistribucionInsumo {
  nombre: string;
  suprimida: boolean;
  niveles: Record<string, number | null>;
}

function aDistribucionInsumo(nombre: string, dist: Distribucion): DistribucionInsumo {
  const niveles: Record<string, number | null> = {};
  for (const [nivel, celda] of Object.entries(dist.celdas)) {
    niveles[nivel] = celda.suprimida ? null : celda.n;
  }
  return { nombre: truncar(nombre), suprimida: dist.totalSuprimido, niveles };
}

export interface InsumoIA {
  ciclo: {
    nombre: string;
    fechaInicio: string;
    fechaFin: string | null;
  };
  empresa: { razonSocial: string };
  participacion: { asignados: number; completados: number };
  semaforo: {
    global: DistribucionInsumo;
    porCentro: DistribucionInsumo[];
    porCategoria: DistribucionInsumo[];
    porDominio: DistribucionInsumo[];
  };
  canalizacionesGr1Abiertas: number;
  /** Solo en el plan de acción: catálogo normativo de la Tabla 4/7. */
  catalogoAcciones?: CriteriosTomaAcciones;
}

export interface InsumoSellado {
  insumo: InsumoIA;
  insumoJson: string;
  insumoSha256: string;
}

interface PuntuadoJson {
  nombre: string;
  nivel: string;
}

/** Lee y arma el insumo BASE (todo menos el catálogo de acciones), ya suprimido. */
async function armarBase(companyId: string, cycleId: string): Promise<InsumoIA> {
  const admin = clienteAdmin();
  const [{ data: empresa }, { data: ciclo }, { count: asignados }, { count: completados }] =
    await Promise.all([
      admin.from('companies').select('legal_name').eq('id', companyId).maybeSingle(),
      admin
        .from('compliance_cycles')
        .select('name, date_start, date_end')
        .eq('company_id', companyId)
        .eq('id', cycleId)
        .maybeSingle(),
      admin
        .from('questionnaire_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('cycle_id', cycleId),
      admin
        .from('questionnaire_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('cycle_id', cycleId)
        .not('completed_at', 'is', null),
    ]);

  const vigentes = await vigentesDeCiclo(companyId, cycleId);
  const global = semaforoGlobal(vigentes);
  const porCentro = semaforoPorCentro(vigentes);
  const porCategoria = distribucionPorNombre(
    vigentes.flatMap((v) =>
      v.categorias.map((c: PuntuadoJson) => ({ nombre: c.nombre, nivel: c.nivel })),
    ),
  );
  const porDominio = distribucionPorNombre(
    vigentes.flatMap((v) =>
      v.dominios.map((d: PuntuadoJson) => ({ nombre: d.nombre, nivel: d.nivel })),
    ),
  );

  // Conteo de canalizaciones GR-I abiertas (solo el número).
  const { count: gr1 } = await admin
    .from('gr1_results')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('cycle_id', cycleId)
    .eq('requiere_valoracion', true)
    .eq('canalizacion_estatus', 'pendiente');

  return {
    ciclo: {
      nombre: truncar(ciclo?.name ?? ''),
      fechaInicio: ciclo?.date_start ?? '',
      fechaFin: ciclo?.date_end ?? null,
    },
    empresa: { razonSocial: truncar(empresa?.legal_name ?? '') },
    participacion: { asignados: asignados ?? 0, completados: completados ?? 0 },
    semaforo: {
      global: aDistribucionInsumo('Calificación final', global),
      porCentro: porCentro.map((c) => aDistribucionInsumo(c.centro, c.distribucion)),
      porCategoria: [...porCategoria.entries()].map(([n, d]) => aDistribucionInsumo(n, d)),
      porDominio: [...porDominio.entries()].map(([n, d]) => aDistribucionInsumo(n, d)),
    },
    canalizacionesGr1Abiertas: gr1 ?? 0,
  };
}

function sellar(insumo: InsumoIA): InsumoSellado {
  const { json, sha256 } = selloCanonico(insumo);
  return { insumo, insumoJson: json, insumoSha256: sha256 };
}

/** Insumo del RESUMEN ejecutivo: base ya suprimida, sin catálogo de acciones. */
export async function armarInsumoResumen(
  companyId: string,
  cycleId: string,
): Promise<InsumoSellado> {
  return sellar(await armarBase(companyId, cycleId));
}

/** Insumo del PLAN de acción: base + catálogo normativo Tabla 4/7 (para que la IA ancle
 * cada medida a una acción del catálogo). */
export async function armarInsumoPlan(companyId: string, cycleId: string): Promise<InsumoSellado> {
  const base = await armarBase(companyId, cycleId);
  const { data: criteriosRow } = await clienteAdmin()
    .from('system_config')
    .select('value')
    .eq('key', 'criterios_toma_acciones')
    .maybeSingle();
  const catalogo = (criteriosRow?.value as CriteriosTomaAcciones | undefined) ?? undefined;
  return sellar({ ...base, catalogoAcciones: catalogo });
}
