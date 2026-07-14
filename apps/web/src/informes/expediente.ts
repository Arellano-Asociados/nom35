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
  /** policies.title de la política acusada. */
  tituloPolitica: string;
  /** policies.version de la política acusada. */
  versionPolitica: string;
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

// ── Piezas de la Fase 4 (ciclo normativo completo) ───────────────────────────

export interface EntradaDifusionExpediente {
  version: number;
  /** Sello publicado en dissemination_records; DEBE ser el sha256 de resumenJson. */
  sha256: string;
  publicadaEl: string;
  /** JSON canónico del resumen tal como se selló: se archiva byte a byte para que el
   * sha256 del archivo sea verificable contra el registro publicado. */
  resumenJson: string;
  acuses: readonly { nombreEmpleado: string; version: number; fechaAcuse: string }[];
}

export interface EntradaAvancePrograma {
  descripcion: string;
  nivelAccion: string | null;
  areas: string | null;
  responsable: string;
  fechaCompromiso: string | null;
  estatus: string;
  fechaCompletado: string | null;
  /** Huella de la evidencia adjunta (el archivo en sí no se embebe: se referencia). */
  evidenciaSha256: string | null;
}

export interface EntradaProgramaExpediente {
  /** PDF del documento Programa (8.4), ya renderizado por el caller. */
  pdf: Buffer;
  avances: readonly EntradaAvancePrograma[];
}

/** SOLO conteos agregados del buzón: jamás folios, contenido ni identidad. */
export interface EntradaBuzonAgregado {
  categoria: string;
  estatus: string;
  /** yyyy-mm */
  mes: string;
  conteo: number;
}

export interface EntradaCuestionarioAplicado {
  guia: string;
  /** Sello del instrumento; DEBE ser el sha256 de itemsJson. */
  sha256: string;
  /** JSON canónico de los ítems aplicados (número + texto oficial + estructura). */
  itemsJson: string;
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
  /** Constancia de difusión vigente del ciclo (5.7 e / 7.8); ausente si no se publicó. */
  difusion?: EntradaDifusionExpediente | null;
  /** Programa de intervención (8.4) con su avance; ausente si el ciclo no lo tiene. */
  programa?: EntradaProgramaExpediente | null;
  /** Registro agregado del buzón (8.1 b); vacío/ausente si no hay quejas. */
  buzonAgregado?: readonly EntradaBuzonAgregado[];
  /** Instrumentos aplicados en el ciclo, sellados por guía. */
  cuestionariosAplicados?: readonly EntradaCuestionarioAplicado[];
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

// Caracteres que Excel/Sheets interpreta como inicio de fórmula al abrir un CSV (conjunto
// canónico de OWASP para neutralización de CSV injection: =, +, -, @, tab y retorno de carro).
const INICIO_FORMULA = /^[=+\-@\t\r]/;

/**
 * Escapa un campo CSV: primero neutraliza formula injection (si el valor inicia con
 * =, +, -, @, tab o retorno de carro —conjunto canónico OWASP—, antepone un apóstrofo —
 * convención estándar de Excel para forzar texto, p. ej. un nombre de empleado capturado
 * como `=HYPERLINK("http://evil","x")` no debe ejecutarse como fórmula al abrir el
 * expediente en Excel), y LUEGO aplica el
 * entrecomillado RFC 4180 (comillas dobles alrededor si trae coma, comilla o salto de
 * línea) sobre el resultado ya neutralizado.
 *
 * Tradeoff aceptado: un valor numérico legítimamente negativo recibiría un apóstrofo
 * espurio (dejaría de leerse como número en Excel, pero el valor se sigue mostrando
 * correctamente como texto). Ninguna columna de este módulo produce hoy valores
 * negativos (conteos y asignaciones son siempre >= 0; fechas son ISO y empiezan con
 * dígito), así que el costo es hipotético, no actual.
 */
function escaparCampoCsv(valor: string): string {
  const neutralizado = INICIO_FORMULA.test(valor) ? `'${valor}` : valor;
  if (/[",\r\n]/.test(neutralizado)) {
    return `"${neutralizado.replace(/"/g, '""')}"`;
  }
  return neutralizado;
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
    ['empleado', 'politica', 'version', 'fecha_acuse'],
    filas.map((f) => [f.nombreEmpleado, f.tituloPolitica, f.versionPolitica, f.fechaAcuse]),
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

function csvAcusesDifusion(filas: EntradaDifusionExpediente['acuses']): Buffer {
  return construirCsv(
    ['empleado', 'version', 'fecha_acuse'],
    filas.map((f) => [f.nombreEmpleado, String(f.version), f.fechaAcuse]),
  );
}

function csvAvancesPrograma(filas: readonly EntradaAvancePrograma[]): Buffer {
  return construirCsv(
    [
      'descripcion',
      'nivel_accion',
      'areas',
      'responsable',
      'fecha_compromiso',
      'estatus',
      'fecha_completado',
      'evidencia_sha256',
    ],
    filas.map((f) => [
      f.descripcion,
      f.nivelAccion ?? '',
      f.areas ?? '',
      f.responsable,
      f.fechaCompromiso ?? '',
      f.estatus,
      f.fechaCompletado ?? '',
      f.evidenciaSha256 ?? '',
    ]),
  );
}

function csvBuzonAgregado(filas: readonly EntradaBuzonAgregado[]): Buffer {
  return construirCsv(
    ['categoria', 'estatus', 'mes', 'conteo'],
    filas.map((f) => [f.categoria, f.estatus, f.mes, String(f.conteo)]),
  );
}

function nombreInstrumento(guia: string): string {
  return `cuestionario-aplicado-${guia.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
}

interface ArchivoPendiente {
  nombre: string;
  contenido: Buffer;
  /** Una línea para el índice legible. */
  descripcion: string;
}

/**
 * Arma el expediente de inspección: un ZIP con TODAS las piezas del ciclo — informe
 * 7.9, política + acuses, instrumentos aplicados sellados, constancia de difusión con
 * sus acuses, Programa de intervención con avances, registro agregado del buzón,
 * evidencia de proceso — más un `INDICE.txt` legible (PRIMERA entrada) y el
 * `manifiesto.json` con el sha256 de cada archivo. Las piezas faltantes se declaran
 * explícitamente como "ausente" en el índice y el manifiesto: jamás se omiten en
 * silencio (el expediente nunca miente).
 */
export async function armarExpediente(
  entrada: EntradaExpediente,
): Promise<{ zip: Buffer; manifiesto: ManifiestoExpediente }> {
  const pendientes: ArchivoPendiente[] = [];
  const ausentes: string[] = [];

  function preparar(nombre: string, contenido: Buffer, descripcion: string): void {
    pendientes.push({ nombre, contenido, descripcion });
  }

  preparar(
    'informe-7-9.pdf',
    entrada.pdfInforme,
    'Informe normativo de resultados (secciones a-g)',
  );

  let politicaPublicada: 'presente' | 'ausente' = 'ausente';
  if (entrada.politica) {
    politicaPublicada = 'presente';
    const extension = extname(entrada.politica.nombreArchivo) || '.bin';
    preparar(
      `politica-prevencion${extension}`,
      entrada.politica.bytes,
      'Política de prevención de riesgos psicosociales publicada',
    );
  } else {
    ausentes.push('Política de prevención de riesgos psicosociales: AUSENTE (no publicada)');
  }

  preparar(
    'acuses-politica.csv',
    csvAcusesPolitica(entrada.acusesPolitica),
    'Acuses de recibo de la política por los trabajadores',
  );
  preparar(
    'participacion.csv',
    csvParticipacion(entrada.participacion),
    'Participación por centro de trabajo (cuestionarios asignados y completados)',
  );
  preparar(
    'acciones.csv',
    csvAcciones(entrada.datos.acciones),
    'Acciones del Capítulo 8 registradas en el ciclo',
  );
  preparar('capacitacion.csv', csvCapacitacion(entrada.capacitacion), 'Registros de capacitación');
  preparar(
    'resumen-auditoria.csv',
    csvResumenAuditoria(entrada.resumenAuditoria),
    'Resumen de la bitácora de auditoría (conteo de eventos por tipo)',
  );

  for (const instrumento of entrada.cuestionariosAplicados ?? []) {
    preparar(
      nombreInstrumento(instrumento.guia),
      Buffer.from(instrumento.itemsJson, 'utf-8'),
      `Instrumento aplicado (${instrumento.guia}), sellado sha256 al aplicarse`,
    );
  }

  if (entrada.difusion) {
    // Byte a byte el JSON canónico sellado: el sha256 del archivo ES el sello
    // publicado en dissemination_records — verificable por cualquier tercero.
    preparar(
      'constancia-difusion.json',
      Buffer.from(entrada.difusion.resumenJson, 'utf-8'),
      `Constancia de difusión de resultados a los trabajadores (5.7 e / 7.8), versión ${entrada.difusion.version} publicada el ${entrada.difusion.publicadaEl}`,
    );
    preparar(
      'acuses-difusion.csv',
      csvAcusesDifusion(entrada.difusion.acuses),
      'Acuses "Enterado" de los trabajadores sobre la difusión de resultados',
    );
  } else {
    ausentes.push('Constancia de difusión de resultados (5.7 e / 7.8): AUSENTE (no publicada)');
  }

  if (entrada.programa) {
    preparar(
      'programa-intervencion.pdf',
      entrada.programa.pdf,
      'Programa de intervención (numeral 8.4) con sus seis elementos',
    );
    preparar(
      'programa-avances.csv',
      csvAvancesPrograma(entrada.programa.avances),
      'Control de avances del programa (8.4 d): acciones, estatus y evidencia por huella',
    );
  } else {
    ausentes.push('Programa de intervención (8.3/8.4): AUSENTE (el ciclo no lo tiene)');
  }

  if ((entrada.buzonAgregado ?? []).length > 0) {
    preparar(
      'buzon-registro.csv',
      csvBuzonAgregado(entrada.buzonAgregado ?? []),
      'Registro agregado del buzón de quejas (8.1 b): conteos por categoría, estado y mes — sin contenido ni identidad',
    );
  } else {
    ausentes.push('Registro agregado del buzón de quejas: sin quejas registradas');
  }

  const archivos: ArchivoManifiesto[] = pendientes.map((p) => ({
    nombre: p.nombre,
    sha256: sha256Hex(p.contenido),
    bytes: p.contenido.length,
  }));

  // Índice legible (es-MX) como PRIMERA entrada del ZIP: qué contiene el expediente,
  // qué falta y la huella de integridad de cada archivo.
  const indice = Buffer.from(
    [
      'EXPEDIENTE DE INSPECCIÓN — NOM-035-STPS-2018',
      `Empresa: ${entrada.datos.empresa.razonSocial}`,
      `Ciclo: ${entrada.datos.ciclo.nombre}`,
      `Generado: ${entrada.generadoEl}`,
      '',
      'CONTENIDO (con huella de integridad SHA-256 por archivo):',
      ...pendientes.flatMap((p, i) => {
        const archivo = archivos[i] as ArchivoManifiesto;
        return [`${i + 1}. ${p.nombre} — ${p.descripcion}`, `   sha256: ${archivo.sha256}`];
      }),
      ...(ausentes.length > 0 ? ['', 'PIEZAS NO INCLUIDAS (declaradas, no omitidas):'] : []),
      ...ausentes.map((a) => `- ${a}`),
      '',
      'El manifiesto.json contiene esta misma lista en formato verificable por máquina.',
      '',
    ].join('\r\n'),
    'utf-8',
  );

  const zip = new JSZip();
  zip.file('INDICE.txt', indice);
  for (const p of pendientes) {
    zip.file(p.nombre, p.contenido);
  }

  const manifiesto: ManifiestoExpediente = {
    empresa: entrada.datos.empresa.razonSocial,
    ciclo: entrada.datos.ciclo.nombre,
    generadoEl: entrada.generadoEl,
    politicaPublicada,
    archivos: [
      { nombre: 'INDICE.txt', sha256: sha256Hex(indice), bytes: indice.length },
      ...archivos,
    ],
  };
  zip.file('manifiesto.json', JSON.stringify(manifiesto, null, 2));

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return { zip: zipBuffer, manifiesto };
}
