import { renderToBuffer } from '@react-pdf/renderer';
import type { DatosInforme79 } from '../lib/informe';
import { Informe79Pdf } from './informe-79-pdf';

// Módulo PURO respecto a I/O: no hace llamadas a Supabase, no calcula fechas
// (recibe `DatosInforme79` ya armado por `armarDatosInforme79`) y solo
// convierte esos datos a bytes de PDF. El hash SHA-256 del documento se
// calcula y registra por el llamador (fuera de este módulo) en el expediente
// de inspección; este módulo no conoce nada de BD.

/**
 * Genera el PDF del informe de resultados (numeral 7.9 NOM-035-STPS-2018) a
 * partir de los datos ya agregados. No contiene respuestas ni resultados
 * individuales (regla inviolable 4): solo lo que ya trae `DatosInforme79`.
 */
export async function generarPdfInforme79(datos: DatosInforme79): Promise<Buffer> {
  return renderToBuffer(Informe79Pdf({ datos }));
}
