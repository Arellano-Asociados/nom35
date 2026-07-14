import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { EntradaAvancePrograma } from './expediente';

// Documento "Programa de intervención" (numeral 8.4 de la NOM-035-STPS-2018):
// el artefacto que el inspector pide (la auditoría v0 señaló que una lista suelta
// de acciones no acredita el Programa). Se estructura por los seis incisos del
// 8.4. Server-side con @react-pdf/renderer, igual que el informe 7.9. Solo
// contiene el plan y su avance: nada de resultados individuales (regla 4).

const ETIQUETAS_NIVEL_ACCION: Record<string, string> = {
  primer_nivel: 'Primer nivel (organizacional)',
  segundo_nivel: 'Segundo nivel (grupal)',
  tercer_nivel: 'Tercer nivel (individual / clínico)',
};

const ETIQUETAS_ESTATUS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
};

export interface DatosProgramaPdf {
  empresa: string;
  centroTrabajo: string;
  ciclo: string;
  /** Fechas ya formateadas (es-MX) por el caller: este módulo no formatea ni calcula. */
  creadoEl: string;
  generadoEl: string;
  scopeAreas: string;
  responsible: string;
  postEvaluation: string | null;
  postEvaluationDate: string | null;
  acciones: readonly EntradaAvancePrograma[];
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 36,
    color: '#111827',
  },
  encabezado: {
    borderBottomWidth: 2,
    borderBottomColor: '#111827',
    paddingBottom: 8,
    marginBottom: 12,
  },
  titulo: { fontFamily: 'Helvetica-Bold', fontSize: 14, marginBottom: 2 },
  subtitulo: { fontSize: 9, color: '#374151' },
  seccion: { marginTop: 12 },
  tituloSeccion: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#9CA3AF',
    paddingBottom: 2,
  },
  parrafo: { marginBottom: 4, lineHeight: 1.4 },
  accion: {
    marginBottom: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  accionTitulo: { fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  meta: { fontSize: 9, color: '#374151' },
  pie: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: '#6B7280',
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
    paddingTop: 4,
  },
});

export function ProgramaPdf({ datos }: { datos: DatosProgramaPdf }) {
  const completadas = datos.acciones.filter((a) => a.estatus === 'completada').length;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Programa de intervención</Text>
          <Text style={styles.subtitulo}>
            NOM-035-STPS-2018, numeral 8.4 · {datos.empresa} · {datos.centroTrabajo} · {datos.ciclo}
          </Text>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>
            a) Áreas de trabajo y/o trabajadores sujetos al programa
          </Text>
          <Text style={styles.parrafo}>{datos.scopeAreas}</Text>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>
            b) y c) Tipo de acciones, medidas de control y fechas programadas
          </Text>
          {datos.acciones.length === 0 ? (
            <Text style={styles.parrafo}>Sin acciones registradas.</Text>
          ) : (
            datos.acciones.map((a, i) => (
              <View key={i} style={styles.accion} wrap={false}>
                <Text style={styles.accionTitulo}>
                  {i + 1}. {a.descripcion}
                </Text>
                <Text style={styles.meta}>
                  {a.nivelAccion
                    ? `${ETIQUETAS_NIVEL_ACCION[a.nivelAccion] ?? a.nivelAccion} · `
                    : ''}
                  {a.areas ? `Áreas: ${a.areas} · ` : ''}
                  Responsable: {a.responsable}
                  {a.fechaCompromiso ? ` · Fecha programada: ${a.fechaCompromiso}` : ''}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>d) Control de los avances de la implementación</Text>
          <Text style={styles.parrafo}>
            {completadas} de {datos.acciones.length} acciones completadas al momento de generar este
            documento.
          </Text>
          {datos.acciones.map((a, i) => (
            <Text key={i} style={styles.meta}>
              {i + 1}. {ETIQUETAS_ESTATUS[a.estatus] ?? a.estatus}
              {a.fechaCompletado ? ` (completada: ${a.fechaCompletado})` : ''}
              {a.evidenciaSha256 ? ` · Evidencia adjunta, huella ${a.evidenciaSha256}` : ''}
            </Text>
          ))}
        </View>

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>
            e) Evaluación posterior a la aplicación de las medidas de control
          </Text>
          <Text style={styles.parrafo}>
            {datos.postEvaluation
              ? `${datos.postEvaluation}${datos.postEvaluationDate ? ` (fecha: ${datos.postEvaluationDate})` : ''}`
              : 'Pendiente de definir (el numeral 8.4 e) la exige "en su caso").'}
          </Text>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>f) Responsable de su ejecución</Text>
          <Text style={styles.parrafo}>{datos.responsible}</Text>
        </View>

        <Text style={styles.pie} fixed>
          Programa creado el {datos.creadoEl} · Documento generado el {datos.generadoEl} por la
          plataforma Constata. La huella SHA-256 de este PDF consta en el manifiesto del expediente
          de inspección.
        </Text>
      </Page>
    </Document>
  );
}
