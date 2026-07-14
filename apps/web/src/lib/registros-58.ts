import { construirCsv } from './csv';
import { resultadosVigentesPorAsignacion } from './informe';

// Registros del numeral 5.8 de la NOM-035: los que el patrón debe CONSERVAR y exhibir
// ante una inspección de la STPS.
//
//   5.8 a) los resultados de la identificación y análisis de los factores de riesgo
//          psicosocial y, en su caso, de la evaluación del entorno organizacional;
//   5.8 c) las relaciones de los trabajadores que fueron sujetos a exámenes o
//          valoraciones clínicas y a los que se les practicaron.
//
// AMBOS contienen datos de salud POR PERSONA: son exclusivos del Responsable Designado,
// con auditoría fail-closed en la acción que los genera (regla inviolable 5). Este módulo
// es PURO: arma los CSVs a partir de filas ya leídas y autorizadas por el caller.

export interface NivelNombrado {
  nombre: string;
  nivel: string;
}

/** Fila de resultado tal como llega de `risk_results` (con los campos de vigencia). */
export interface FilaResultado58a {
  id: string;
  assignmentId: string;
  supersedesId: string | null;
  /** ISO; es también la fecha que se imprime en el registro. */
  createdAt: string;
  nombreEmpleado: string;
  nombreCentro: string;
  /** Código de la guía aplicada (GR-II / GR-III). */
  guia: string;
  cfinal: number;
  nivelFinal: string;
  categorias: readonly NivelNombrado[];
  dominios: readonly NivelNombrado[];
  versionMotor: string;
}

export interface EntradaRegistro58c {
  nombreEmpleado: string;
  nombreCentro: string;
  /** "Ciclo 2026" o "Acontecimiento traumático del 10/07/2026". */
  origen: string;
  esEventoTraumatico: boolean;
  presentoAcontecimiento: boolean;
  requiereValoracion: boolean;
  /** null mientras el RD no ha registrado la canalización. */
  estatusCanalizacion: string | null;
  fechaCanalizacion: string | null;
}

/** "Ambiente de trabajo=bajo; Carga de trabajo=alto" — un CSV no anida, y una columna por
 * categoría/dominio haría el archivo ilegible y frágil ante cambios de guía. */
function compactarNiveles(niveles: readonly NivelNombrado[]): string {
  return niveles.map((n) => `${n.nombre}=${n.nivel}`).join('; ');
}

/**
 * Reduce los resultados al VIGENTE por asignación con el MISMO criterio compartido que el
 * dashboard, el informe y la página de acciones (regla inviolable 1: el recálculo agrega
 * una fila con supersedes_id, jamás edita). El registro que se exhibe ante la STPS debe
 * traer el resultado vigente, no el historial de recálculos.
 */
export function filasRegistro58a(
  resultados: readonly FilaResultado58a[],
): readonly FilaResultado58a[] {
  return resultadosVigentesPorAsignacion(resultados);
}

export function csvRegistro58a(resultados: readonly FilaResultado58a[]): Buffer {
  const vigentes = filasRegistro58a(resultados);
  return construirCsv(
    [
      'empleado',
      'centro_trabajo',
      'cuestionario',
      'calificacion_final',
      'nivel_final',
      'niveles_por_categoria',
      'niveles_por_dominio',
      'fecha',
      'version_motor',
    ],
    vigentes.map((r) => [
      r.nombreEmpleado,
      r.nombreCentro,
      r.guia,
      String(r.cfinal),
      r.nivelFinal,
      compactarNiveles(r.categorias),
      compactarNiveles(r.dominios),
      r.createdAt,
      r.versionMotor,
    ]),
  );
}

const SI_NO = (valor: boolean) => (valor ? 'Sí' : 'No');

export function csvRegistro58c(filas: readonly EntradaRegistro58c[]): Buffer {
  return construirCsv(
    [
      'empleado',
      'centro_trabajo',
      'origen',
      'presento_acontecimiento',
      'requiere_valoracion',
      'estatus_canalizacion',
      'fecha_canalizacion',
    ],
    filas.map((f) => [
      f.nombreEmpleado,
      f.nombreCentro,
      f.origen,
      SI_NO(f.presentoAcontecimiento),
      SI_NO(f.requiereValoracion),
      // Sin canalización registrada: columnas vacías. Jamás se inventa un estatus.
      f.estatusCanalizacion ?? '',
      f.fechaCanalizacion ?? '',
    ]),
  );
}
