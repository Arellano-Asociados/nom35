import { MOTOR_NOM035_VERSION, type NivelRiesgo } from '@nom35/motor-nom035';
import {
  celda,
  distribucionNiveles,
  distribucionPorNombre,
  NIVELES,
  type Distribucion,
} from './agregados';

// Módulo PURO de armado de datos del informe 7.9: no hace I/O, no llama a
// Date.now()/new Date() (el caller inyecta `generadoEl`) y reutiliza las
// convenciones existentes de la app: la supresión n<3 de `agregados.ts` y el
// criterio de "fila vigente" de `risk_results.supersedes_id` (regla inviolable 1,
// mismo criterio documentado para el dashboard). No vuelve a calificar nada:
// solo reorganiza resultados ya calculados por el motor.

export type NomCategory = 'solo_gr1' | 'gr1_gr2' | 'gr1_gr3';

const GUIAS_POR_CATEGORIA: Record<NomCategory, string[]> = {
  solo_gr1: ['GR-I'],
  gr1_gr2: ['GR-I', 'GR-II'],
  gr1_gr3: ['GR-I', 'GR-III'],
};

const ETIQUETA_NIVEL: Record<NivelRiesgo, string> = {
  nulo: 'Nulo',
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  muy_alto: 'Muy alto',
};

export interface DatosInforme79 {
  empresa: { razonSocial: string; rfc: string };
  centros: Array<{
    nombre: string;
    domicilio: string;
    actividad: string;
    headcount: number;
    nomCategory: string;
    guias: string[];
  }>;
  ciclo: {
    nombre: string;
    fechaInicio: string;
    fechaFin: string | null;
    evaluadorNombre: string;
    evaluadorCedula: string | null;
  };
  participacion: { asignados: number; completados: number };
  resultados: {
    global: ReturnType<typeof distribucionNiveles>;
    categorias: ReturnType<typeof distribucionPorNombre>;
    dominios: ReturnType<typeof distribucionPorNombre>;
  };
  gr1: { evaluados: number; requierenValoracion: number | null }; // null = suprimido n<3
  conclusiones: string[];
  acciones: Array<{
    descripcion: string;
    nivelOrigen: string;
    responsable: string;
    fechaCompromiso: string | null;
    estatus: string;
  }>;
  motorVersion: string;
  generadoEl: string; // ISO, lo inyecta la acción (no usar Date.now aquí)
}

export interface EntradaEmpresa {
  razonSocial: string;
  rfc: string | null;
}

export interface EntradaCentro {
  nombre: string;
  domicilio: string | null;
  actividad: string | null;
  headcount: number;
  nomCategory: NomCategory;
}

export interface EntradaCiclo {
  nombre: string;
  fechaInicio: string;
  fechaFin: string | null;
  evaluadorNombre: string;
  evaluadorCedula: string | null;
}

export interface EntradaAsignacion {
  id: string;
  completada: boolean;
}

/** Espejo de una fila de risk_results relevante para el informe. */
export interface EntradaResultado {
  id: string;
  assignmentId: string;
  /** risk_results.supersedes_id: si otra fila apunta a esta, esta NO es vigente. */
  supersedesId: string | null;
  createdAt: string;
  nivelFinal: NivelRiesgo;
  categorias: readonly { nombre: string; nivel: string }[];
  dominios: readonly { nombre: string; nivel: string }[];
  engineVersion: string;
}

/** Espejo de una fila de gr1_results relevante para el informe. */
export interface EntradaResultadoGr1 {
  assignmentId: string;
  requiereValoracion: boolean;
}

/** Espejo de una fila de action_items. */
export interface EntradaAccion {
  descripcion: string;
  nivelOrigen: string;
  responsable: string;
  fechaCompromiso: string | null;
  estatus: string;
}

export interface EntradaInforme79 {
  empresa: EntradaEmpresa;
  centros: readonly EntradaCentro[];
  ciclo: EntradaCiclo;
  asignaciones: readonly EntradaAsignacion[];
  resultadosVigentes: readonly EntradaResultado[];
  resultadosGr1: readonly EntradaResultadoGr1[];
  acciones: readonly EntradaAccion[];
  generadoEl: string;
}

/**
 * Reduce los resultados (que pueden traer historial de recálculo) al VIGENTE por
 * asignación: la fila que ningún `supersedes_id` de otra fila señala. Si por algún
 * motivo quedara más de una vigente para la misma asignación, gana la más reciente
 * por `createdAt` (regla inviolable 1: recálculo = fila nueva con supersedes_id,
 * nunca UPDATE).
 */
function resultadosVigentesPorAsignacion(
  resultados: readonly EntradaResultado[],
): EntradaResultado[] {
  const supersedidos = new Set(
    resultados.map((r) => r.supersedesId).filter((id): id is string => id !== null),
  );
  const vigentes = resultados.filter((r) => !supersedidos.has(r.id));

  const porAsignacion = new Map<string, EntradaResultado>();
  for (const r of vigentes) {
    const actual = porAsignacion.get(r.assignmentId);
    if (!actual || r.createdAt > actual.createdAt) {
      porAsignacion.set(r.assignmentId, r);
    }
  }
  return [...porAsignacion.values()];
}

/** Nivel con mayor conteo (ties: gana el de menor severidad, orden de NIVELES). */
function nivelPredominante(niveles: readonly NivelRiesgo[]): NivelRiesgo | null {
  if (niveles.length === 0) return null;
  const conteos = new Map<NivelRiesgo, number>();
  for (const nivel of niveles) conteos.set(nivel, (conteos.get(nivel) ?? 0) + 1);

  let mejor: NivelRiesgo = NIVELES[0];
  let mejorConteo = -1;
  for (const nivel of NIVELES) {
    const c = conteos.get(nivel) ?? 0;
    if (c > mejorConteo) {
      mejorConteo = c;
      mejor = nivel;
    }
  }
  return mejor;
}

/** true si algún nivel (string suelto, ya que categorías/dominios vienen de jsonb) amerita
 * acciones del Capítulo 8. */
function ameritaAccionesCapitulo8(nivel: string): boolean {
  return nivel === 'medio' || nivel === 'alto' || nivel === 'muy_alto';
}

/**
 * Conclusiones deterministas (numeral 7.9): nivel predominante global (la sentencia de
 * "nivel predominante" es explícitamente sobre el nivel GLOBAL); obligación de acciones
 * del Capítulo 8 si hay algún nivel medio/alto/muy alto, ya sea a nivel global O en
 * cualquier categoría/dominio (`nivelesCategoriasDominios`) — un ciclo puede tener
 * `nivel_final` global bajo en todos los empleados pero un dominio o categoría en
 * alto/muy alto, y ese caso también obliga acciones del Capítulo 8 (la tabla de acciones
 * ya las lista por `origin_level`; las conclusiones no deben contradecirla); recordatorio
 * de reevaluación a 2 años (siempre presente).
 */
function construirConclusiones(
  niveles: readonly NivelRiesgo[],
  nivelesCategoriasDominios: readonly string[],
): string[] {
  const conclusiones: string[] = [];

  const predominante = nivelPredominante(niveles);
  if (predominante) {
    conclusiones.push(
      `El nivel de riesgo predominante en la organización es ${ETIQUETA_NIVEL[predominante]}.`,
    );
  }

  const requiereAcciones =
    niveles.some(ameritaAccionesCapitulo8) ||
    nivelesCategoriasDominios.some(ameritaAccionesCapitulo8);
  if (requiereAcciones) {
    conclusiones.push(
      'Se identificaron niveles de riesgo medio, alto o muy alto: la organización debe ' +
        'implementar y documentar acciones de intervención conforme al Capítulo 8 de la ' +
        'NOM-035-STPS-2018.',
    );
  }

  conclusiones.push(
    'Esta evaluación debe repetirse en un plazo no mayor a dos años, conforme al numeral ' +
      '7.9 de la NOM-035-STPS-2018.',
  );

  return conclusiones;
}

export function armarDatosInforme79(entrada: EntradaInforme79): DatosInforme79 {
  const vigentes = resultadosVigentesPorAsignacion(entrada.resultadosVigentes);
  const niveles = vigentes.map((r) => r.nivelFinal);

  const global: Distribucion = distribucionNiveles(niveles);
  const categorias = distribucionPorNombre(
    vigentes.flatMap((r) => r.categorias.map((c) => ({ nombre: c.nombre, nivel: c.nivel }))),
  );
  const dominios = distribucionPorNombre(
    vigentes.flatMap((r) => r.dominios.map((d) => ({ nombre: d.nombre, nivel: d.nivel }))),
  );

  const evaluadosGr1 = entrada.resultadosGr1.length;
  const requierenGr1 = entrada.resultadosGr1.filter((r) => r.requiereValoracion).length;
  // celda() ya distingue n=0 ("sin datos") de 0<n<3 (supresión → n: null).
  const requierenValoracion = celda(requierenGr1, evaluadosGr1).n;

  const completados = entrada.asignaciones.filter((a) => a.completada).length;

  // Determinista: NO tomar la versión de una fila arbitraria (el orden de llegada de la
  // BD/Map no está garantizado). Si hay vigentes con más de un engine_version (p. ej. tras
  // una actualización del motor a mitad de ciclo), se listan todas, ordenadas, para que el
  // informe sea reproducible sin importar el orden de iteración.
  const versionesMotor = [...new Set(vigentes.map((r) => r.engineVersion))].sort();
  const motorVersion = versionesMotor.length > 0 ? versionesMotor.join(', ') : MOTOR_NOM035_VERSION;

  const nivelesCategoriasDominios = vigentes.flatMap((r) => [
    ...r.categorias.map((c) => c.nivel),
    ...r.dominios.map((d) => d.nivel),
  ]);

  return {
    empresa: {
      razonSocial: entrada.empresa.razonSocial,
      rfc: entrada.empresa.rfc ?? '',
    },
    centros: entrada.centros.map((c) => ({
      nombre: c.nombre,
      domicilio: c.domicilio ?? '',
      actividad: c.actividad ?? '',
      headcount: c.headcount,
      nomCategory: c.nomCategory,
      guias: GUIAS_POR_CATEGORIA[c.nomCategory],
    })),
    ciclo: { ...entrada.ciclo },
    participacion: {
      asignados: entrada.asignaciones.length,
      completados,
    },
    resultados: { global, categorias, dominios },
    gr1: { evaluados: evaluadosGr1, requierenValoracion },
    conclusiones: construirConclusiones(niveles, nivelesCategoriasDominios),
    acciones: entrada.acciones.map((a) => ({ ...a })),
    motorVersion,
    generadoEl: entrada.generadoEl,
  };
}
