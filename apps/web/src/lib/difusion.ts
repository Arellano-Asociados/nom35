import type { NivelRiesgo } from '@nom35/motor-nom035';
import { distribucionNiveles, distribucionPorNombre, type Distribucion } from './agregados';
import { selloCanonico } from './cuestionarios-sello';

// Difusión de resultados a los trabajadores (NOM-035 5.7 e / 7.8).
//
// La constancia es una INSTANTÁNEA agregada del ciclo: pasa por la misma supresión
// n<3 con enmascarado de fila completa que el dashboard (regla inviolable 3) ANTES
// de sellarse, se redacta en lenguaje llano (el trabajador no conoce los códigos
// GR-x ni "Cfinal") y se sella con sha256 sobre JSON canónico para que la evidencia
// de QUÉ se difundió sea verificable ante una inspección. Al ser instantánea, no
// amplía la superficie de inferencia temporal de los agregados en vivo.

type Guia = 'GR-I' | 'GR-II' | 'GR-III';

export interface EntradaDifusion {
  empresa: string;
  ciclo: string;
  centroTrabajo: string;
  /** Fechas ISO (yyyy-mm-dd) del ciclo. */
  fechaInicio: string;
  fechaFin: string | null;
  guias: readonly Guia[];
  /** Nivel final de cada resultado VIGENTE del ciclo (uno por persona evaluada). */
  nivelesFinales: readonly string[];
  /** Pares categoría→nivel de los resultados vigentes. */
  categorias: readonly { nombre: string; nivel: string }[];
  participacion: { asignados: number; completados: number };
  /** Acciones ya comprometidas en el programa de intervención (conteo). */
  accionesComprometidas: number;
  /** Enlace del buzón de quejas de la empresa, si ya está activo (5.7 d). */
  urlBuzon?: string;
}

export interface ResumenDifusion {
  /** Versión del esquema del resumen (para render futuro compatible). */
  esquema: 1;
  empresa: string;
  ciclo: string;
  centroTrabajo: string;
  periodo: { inicio: string; fin: string | null };
  /** Redacción en lenguaje llano para el trabajador. */
  parrafos: string[];
  participacion: { asignados: number; completados: number };
  distribucionGlobal: Distribucion;
  distribucionPorCategoria: { nombre: string; distribucion: Distribucion }[];
  accionesComprometidas: number;
  notaConfidencialidad: string;
  urlBuzon?: string;
}

const DESCRIPCION_GUIA: Record<Guia, string> = {
  'GR-I': 'un cuestionario sobre acontecimientos traumáticos severos en el trabajo',
  'GR-II': 'un cuestionario sobre los factores de riesgo psicosocial de tu entorno de trabajo',
  'GR-III':
    'un cuestionario sobre los factores de riesgo psicosocial y el entorno de tu organización',
};

export function armarResumenDifusion(entrada: EntradaDifusion): ResumenDifusion {
  const distribucionGlobal = distribucionNiveles(entrada.nivelesFinales as string[]);
  const porCategoria = [...distribucionPorNombre(entrada.categorias)]
    .map(([nombre, distribucion]) => ({ nombre, distribucion }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const instrumentos = entrada.guias
    .map((g) => DESCRIPCION_GUIA[g])
    .filter(Boolean)
    .join(' y ');

  const parrafos = [
    `Entre ${entrada.fechaInicio} y ${entrada.fechaFin ?? 'la fecha de este aviso'}, en ${entrada.centroTrabajo} se aplicó ${instrumentos}, como lo pide la norma mexicana NOM-035 de la Secretaría del Trabajo.`,
    `Participaron ${entrada.participacion.completados} de ${entrada.participacion.asignados} personas invitadas. Estos son los resultados generales del grupo: muestran cuántas personas quedaron en cada nivel de atención, nunca resultados de una persona en particular.`,
    entrada.accionesComprometidas > 0
      ? `A partir de estos resultados, la empresa comprometió ${entrada.accionesComprometidas} ${entrada.accionesComprometidas === 1 ? 'acción' : 'acciones'} de mejora con responsables y fechas. Puedes preguntar por su avance a la persona responsable en tu empresa.`
      : 'La empresa revisará estos resultados para decidir las acciones de mejora que correspondan.',
  ];
  if (entrada.urlBuzon) {
    parrafos.push(
      'Si vives o presencias malos tratos, violencia laboral o prácticas que dañan el ambiente de trabajo, puedes reportarlo de forma segura y confidencial —de manera anónima si así lo decides— en el buzón de quejas de tu empresa.',
    );
  }

  return {
    esquema: 1,
    empresa: entrada.empresa,
    ciclo: entrada.ciclo,
    centroTrabajo: entrada.centroTrabajo,
    periodo: { inicio: entrada.fechaInicio, fin: entrada.fechaFin },
    parrafos,
    participacion: entrada.participacion,
    distribucionGlobal,
    distribucionPorCategoria: porCategoria,
    accionesComprometidas: entrada.accionesComprometidas,
    notaConfidencialidad:
      'Los grupos con menos de 3 personas se ocultan por completo: nadie —ni dentro ni fuera de tu empresa— puede conocer tu resultado individual a partir de este aviso.',
    ...(entrada.urlBuzon ? { urlBuzon: entrada.urlBuzon } : {}),
  };
}

/** Sella la constancia: JSON canónico + sha256 (reproducible, verificable). */
export function sellarResumen(resumen: ResumenDifusion): { json: string; sha256: string } {
  return selloCanonico(resumen);
}

/** Niveles válidos re-exportados para los consumidores del resumen. */
export type { NivelRiesgo };
