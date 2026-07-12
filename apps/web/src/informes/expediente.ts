import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import JSZip from 'jszip';
import type { DatosInforme79 } from '../lib/informe';

// Armado PURO del expediente de inspección (numeral 7.9 + evidencia documental,
// CLAUDE.md §1): no hace I/O (no llama a Supabase), recibe filas YA leídas por el caller
// y solo empaqueta un ZIP. Única excepción a "puro": jszip expone una API de generación
// asíncrona (compresión), no implica llamadas externas.
//
// Frontera de datos (reglas inviolables 3 y 4): los CSVs de este expediente son evidencia
// de PROCESO (acuses de política, participación, capacitación, acciones), jamás de
// RESULTADOS. Ninguno de los CSVs generados aquí puede traer niveles de riesgo por
// empleado, respuestas ni nada de `risk_results`/`gr1_results`/`responses`.

export interface EntradaAcusePolitica {
  nombreEmpleado: string;
  /** policy_acknowledgments.acknowledged_at, ISO */
  fechaAcuse: string;
}

export interface EntradaParticipacionCentro {
  nombreCentro: string;
  asignados: number;
  completados: number;
}

export interface EntradaCapacitacion {
  nombreEmpleado: string;
  nombreCapacitacion: string;
  /** training_records.completed_at, ISO (o null si aún no se completa) */
  fechaCompletado: string | null;
  estatus: 'completado' | 'pendiente';
}

export interface EntradaPoliticaArchivo {
  /** Nombre o storage_path del archivo publicado; solo se usa para derivar la extensión. */
  nombreArchivo: string;
  bytes: Buffer;
}

export interface EntradaResumenAuditoria {
  /** audit_log.event_type. */
  eventType: string;
  conteo: number;
}

export interface EntradaExpediente {
  /** Ya armado por armarDatosInforme79: se reutiliza para el contexto empresa/ciclo y Tabla 7. */
  datos: Pick<DatosInforme79, 'empresa' | 'ciclo' | 'acciones'>;
  pdfInforme: Buffer;
  /** null si no hay política de prevención publicada (el manifiesto la marca "ausente"). */
  politica: EntradaPoliticaArchivo | null;
  acusesPolitica: readonly EntradaAcusePolitica[];
  participacion: readonly EntradaParticipacionCentro[];
  capacitacion: readonly EntradaCapacitacion[];
  /** Conteo de eventos de audit_log por tipo, SIN detalles sensibles (sin actor_id, sin
   * entity_id, sin el JSON de `details`): solo `event_type` + conteo. */
  resumenAuditoria: readonly EntradaResumenAuditoria[];
  /** ISO; lo inyecta el caller (este módulo no llama a Date.now/new Date). */
  generadoEl: string;
}

export interface ArchivoManifiesto {
  nombre: string;
  sha256: string;
  bytes: number;
}

export interface ManifiestoExpediente {
  empresa: string;
  ciclo: string;
  generadoEl: string;
  politicaPublicada: 'presente' | 'ausente';
  archivos: ArchivoManifiesto[];
}

const BOM = '\uFEFF';

/** Escapa un campo CSV: comillas dobles alrededor si trae coma, comilla o salto de línea. */
function escaparCampoCsv(valor: string): string {
  if (/[",\r\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

function filaCsv(campos: readonly string[]): string {
  return campos.map(escaparCampoCsv).join(',');
}

/** UTF-8 con BOM (Excel es-MX respeta acentos) y CRLF, con escapado correcto por campo. */
function construirCsv(cabecera: readonly string[], filas: readonly (readonly string[])[]): Buffer {
  const lineas = [cabecera, ...filas].map(filaCsv).join('\r\n');
  return Buffer.from(BOM + lineas + '\r\n', 'utf-8');
}

function sha256Hex(contenido: Buffer): string {
  return createHash('sha256').update(contenido).digest('hex');
}

// Los CSVs de empleados (acuses, capacitación) SOLO llevan nombre + fecha: sin nivel de
// riesgo, sin estatus de resultado, sin ninguna columna que permita ligar a un empleado
// con un resultado de cuestionario (reglas inviolables 3 y 4).

function csvAcusesPolitica(filas: readonly EntradaAcusePolitica[]): Buffer {
  return construirCsv(
    ['empleado', 'fecha_acuse'],
    filas.map((f) => [f.nombreEmpleado, f.fechaAcuse]),
  );
}

function csvParticipacion(filas: readonly EntradaParticipacionCentro[]): Buffer {
  // Cabeceras explícitas "cuestionarios_*": `asignados`/`completados` cuentan filas de
  // questionnaire_assignments, no empleados (cada empleado recibe 2 asignaciones,
  // GR-I + GR-II/III) — ver Finding 2 de la revisión final de M5.
  return construirCsv(
    ['centro_trabajo', 'cuestionarios_asignados', 'cuestionarios_completados'],
    filas.map((f) => [f.nombreCentro, String(f.asignados), String(f.completados)]),
  );
}

function csvAcciones(filas: DatosInforme79['acciones']): Buffer {
  return construirCsv(
    ['descripcion', 'nivel_origen', 'responsable', 'fecha_compromiso', 'estatus'],
    filas.map((f) => [
      f.descripcion,
      f.nivelOrigen,
      f.responsable,
      f.fechaCompromiso ?? '',
      f.estatus,
    ]),
  );
}

function csvCapacitacion(filas: readonly EntradaCapacitacion[]): Buffer {
  return construirCsv(
    ['empleado', 'capacitacion', 'fecha_completado', 'estatus'],
    filas.map((f) => [f.nombreEmpleado, f.nombreCapacitacion, f.fechaCompletado ?? '', f.estatus]),
  );
}

// Conteo de eventos por tipo, sin ningún detalle sensible: ni actor_id, ni entity_id, ni
// el JSON de `details` de audit_log. Solo `event_type` + conteo (reglas inviolables 3 y 4).
function csvResumenAuditoria(filas: readonly EntradaResumenAuditoria[]): Buffer {
  return construirCsv(
    ['evento', 'conteo'],
    filas.map((f) => [f.eventType, String(f.conteo)]),
  );
}

/**
 * Arma el expediente de inspección: un ZIP con el informe 7.9, evidencia de proceso
 * (acuses de política, participación, capacitación, acciones de la Tabla 7) y un
 * manifiesto con el sha256 de cada archivo. Sin política publicada, el ZIP se genera
 * igual (no truena) y el manifiesto lo marca explícitamente como "ausente".
 */
export async function armarExpediente(
  entrada: EntradaExpediente,
): Promise<{ zip: Buffer; manifiesto: ManifiestoExpediente }> {
  const zip = new JSZip();
  const archivos: ArchivoManifiesto[] = [];

  function agregar(nombre: string, contenido: Buffer): void {
    zip.file(nombre, contenido);
    archivos.push({ nombre, sha256: sha256Hex(contenido), bytes: contenido.length });
  }

  agregar('informe-7-9.pdf', entrada.pdfInforme);

  let politicaPublicada: 'presente' | 'ausente' = 'ausente';
  if (entrada.politica) {
    politicaPublicada = 'presente';
    const extension = extname(entrada.politica.nombreArchivo) || '.bin';
    agregar(`politica-prevencion${extension}`, entrada.politica.bytes);
  }

  agregar('acuses-politica.csv', csvAcusesPolitica(entrada.acusesPolitica));
  agregar('participacion.csv', csvParticipacion(entrada.participacion));
  agregar('acciones.csv', csvAcciones(entrada.datos.acciones));
  agregar('capacitacion.csv', csvCapacitacion(entrada.capacitacion));
  agregar('resumen-auditoria.csv', csvResumenAuditoria(entrada.resumenAuditoria));

  const manifiesto: ManifiestoExpediente = {
    empresa: entrada.datos.empresa.razonSocial,
    ciclo: entrada.datos.ciclo.nombre,
    generadoEl: entrada.generadoEl,
    politicaPublicada,
    archivos,
  };
  zip.file('manifiesto.json', JSON.stringify(manifiesto, null, 2));

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return { zip: zipBuffer, manifiesto };
}
