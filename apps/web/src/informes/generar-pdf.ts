import { renderToBuffer } from '@react-pdf/renderer';
import type { DatosInforme77 } from '../lib/informe';
import { Informe77Pdf } from './informe-77-pdf';
import { ProgramaPdf, type DatosProgramaPdf } from './programa-pdf';

// Módulo PURO respecto a I/O: no hace llamadas a Supabase, no calcula fechas
// (recibe `DatosInforme77` ya armado por `armarDatosInforme77`) y solo
// convierte esos datos a bytes de PDF. El hash SHA-256 del documento se
// calcula y registra por el llamador (fuera de este módulo) en el expediente
// de inspección; este módulo no conoce nada de BD.

/**
 * Genera el PDF del informe de resultados (numeral 7.7 NOM-035-STPS-2018) a
 * partir de los datos ya agregados. No contiene respuestas ni resultados
 * individuales (regla inviolable 4): solo lo que ya trae `DatosInforme77`.
 */
export async function generarPdfInforme77(datos: DatosInforme77): Promise<Buffer> {
  return renderToBuffer(Informe77Pdf({ datos }));
}

/** PDF del Programa de intervención (8.4), mismo pipeline puro que el informe. */
export async function generarPdfPrograma(datos: DatosProgramaPdf): Promise<Buffer> {
  return renderToBuffer(ProgramaPdf({ datos }));
}
