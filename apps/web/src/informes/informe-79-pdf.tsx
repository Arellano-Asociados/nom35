import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CeldaAgregado, Distribucion } from '../lib/agregados';
import type { DatosInforme79 } from '../lib/informe';

// Plantilla del informe del numeral 7.9 de la NOM-035-STPS-2018.
//
// NO es un componente cliente de Next.js: vive fuera de `app/` y se ejecuta
// del lado servidor con `@react-pdf/renderer`, una implementación de React
// independiente del DOM/navegador que renderiza a PDF (Helvetica soporta
// acentos/es-MX de forma nativa, sin fuentes externas).
//
// Contiene ÚNICAMENTE datos ya agregados en `DatosInforme79` (regla inviolable
// 4: ningún rol patronal ve respuestas crudas ni resultados individuales). Las
// celdas suprimidas por anti-reidentificación (n < 3, regla inviolable 3) se
// muestran como "— (n<3)", nunca como 0 ni en blanco, para no confundir
// "suprimido" con "cero".

const ETIQUETAS_NIVEL: Record<string, string> = {
  nulo: 'Nulo',
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  muy_alto: 'Muy alto',
};

const ETIQUETAS_CATEGORIA: Record<string, string> = {
  solo_gr1: 'Solo Guía de Referencia I',
  gr1_gr2: 'Guías de Referencia I y II',
  gr1_gr3: 'Guías de Referencia I y III',
};

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
  tituloInforme: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    marginBottom: 2,
  },
  subtituloInforme: {
    fontSize: 9,
    color: '#374151',
  },
  seccion: {
    marginTop: 14,
    marginBottom: 4,
  },
  tituloSeccion: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#9CA3AF',
    paddingBottom: 2,
  },
  filaEtiquetaValor: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  etiqueta: {
    width: 140,
    fontFamily: 'Helvetica-Bold',
  },
  valor: {
    flex: 1,
  },
  centro: {
    marginBottom: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  tabla: {
    marginTop: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  filaTabla: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
  },
  filaTablaUltima: {
    flexDirection: 'row',
  },
  celdaEncabezado: {
    flex: 1,
    padding: 4,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#F3F4F6',
    fontSize: 9,
  },
  celdaEtiquetaFila: {
    flex: 1.4,
    padding: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  celdaValor: {
    flex: 1,
    padding: 4,
    fontSize: 9,
    textAlign: 'center',
  },
  listaItem: {
    marginBottom: 3,
  },
  pie: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: '#9CA3AF',
    paddingTop: 4,
    fontSize: 7,
    color: '#6B7280',
  },
});

function textoCelda(c: CeldaAgregado): string {
  if (c.suprimida) return '— (n<3)';
  return `${c.n} (${c.porcentaje}%)`;
}

// Supresión complementaria (agregados.ts): cuando no hubo celda visible positiva que
// complementar, se oculta el total del grupo (mismo criterio "— (n<3)" que una celda
// suprimida, para no confundir "oculto" con "cero").
function textoTotal(dist: Distribucion): string {
  return dist.totalSuprimido ? '— (n<3)' : String(dist.total);
}

function TablaDistribucion({ titulo, dist }: { titulo: string; dist: Distribucion }) {
  const niveles: Array<keyof Distribucion['celdas']> = [
    'nulo',
    'bajo',
    'medio',
    'alto',
    'muy_alto',
  ];
  return (
    <View style={styles.tabla}>
      <View style={styles.filaTabla}>
        <Text style={styles.celdaEtiquetaFila}>{titulo}</Text>
        {niveles.map((n) => (
          <Text key={n} style={styles.celdaEncabezado}>
            {ETIQUETAS_NIVEL[n]}
          </Text>
        ))}
      </View>
      <View style={styles.filaTablaUltima}>
        <Text style={styles.celdaEtiquetaFila}>Total: {textoTotal(dist)}</Text>
        {niveles.map((n) => (
          <Text key={n} style={styles.celdaValor}>
            {textoCelda(dist.celdas[n])}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function Informe79Pdf({ datos }: { datos: DatosInforme79 }) {
  return (
    <Document
      title={`Informe NOM-035 numeral 7.9 — ${datos.empresa.razonSocial}`}
      author="Plataforma de Cumplimiento NOM-035-STPS-2018"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.encabezado}>
          <Text style={styles.tituloInforme}>
            Informe de resultados — Numeral 7.9 NOM-035-STPS-2018
          </Text>
          <Text style={styles.subtituloInforme}>
            {datos.empresa.razonSocial} — RFC: {datos.empresa.rfc || 'No especificado'}
          </Text>
        </View>

        {/* a) Centro(s) de trabajo evaluados */}
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>a) Centros de trabajo evaluados</Text>
          {datos.centros.map((centro) => (
            <View key={centro.nombre} style={styles.centro}>
              <View style={styles.filaEtiquetaValor}>
                <Text style={styles.etiqueta}>Nombre</Text>
                <Text style={styles.valor}>{centro.nombre}</Text>
              </View>
              <View style={styles.filaEtiquetaValor}>
                <Text style={styles.etiqueta}>Domicilio</Text>
                <Text style={styles.valor}>{centro.domicilio || 'No especificado'}</Text>
              </View>
              <View style={styles.filaEtiquetaValor}>
                <Text style={styles.etiqueta}>Actividad</Text>
                <Text style={styles.valor}>{centro.actividad || 'No especificada'}</Text>
              </View>
              <View style={styles.filaEtiquetaValor}>
                <Text style={styles.etiqueta}>Plantilla (headcount)</Text>
                <Text style={styles.valor}>{centro.headcount}</Text>
              </View>
              <View style={styles.filaEtiquetaValor}>
                <Text style={styles.etiqueta}>Categoría normativa</Text>
                <Text style={styles.valor}>
                  {ETIQUETAS_CATEGORIA[centro.nomCategory] ?? centro.nomCategory}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* b) Método utilizado */}
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>b) Método utilizado</Text>
          <Text>
            Guías de referencia aplicadas:{' '}
            {[...new Set(datos.centros.flatMap((c) => c.guias))].join(', ') || 'No especificado'}.
          </Text>
          <Text style={{ marginTop: 4 }}>
            Ciclo de evaluación: {datos.ciclo.nombre}. Cuestionarios asignados:{' '}
            {datos.participacion.asignados}; cuestionarios completados:{' '}
            {datos.participacion.completados}.
          </Text>
        </View>

        {/* c) Resultados obtenidos */}
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>c) Resultados obtenidos</Text>
          <Text style={{ marginBottom: 4, fontFamily: 'Helvetica-Bold' }}>
            Distribución global de nivel de riesgo
          </Text>
          <TablaDistribucion titulo="Nivel global" dist={datos.resultados.global} />

          {datos.resultados.categorias.size > 0 && (
            <>
              <Text style={{ marginBottom: 4, fontFamily: 'Helvetica-Bold' }}>
                Distribución por categoría
              </Text>
              {[...datos.resultados.categorias.entries()].map(([nombre, dist]) => (
                <TablaDistribucion key={nombre} titulo={nombre} dist={dist} />
              ))}
            </>
          )}

          {datos.resultados.dominios.size > 0 && (
            <>
              <Text style={{ marginBottom: 4, fontFamily: 'Helvetica-Bold' }}>
                Distribución por dominio
              </Text>
              {[...datos.resultados.dominios.entries()].map(([nombre, dist]) => (
                <TablaDistribucion key={nombre} titulo={nombre} dist={dist} />
              ))}
            </>
          )}

          <Text style={{ marginBottom: 4, fontFamily: 'Helvetica-Bold' }}>
            Resumen de la Guía de Referencia I (acontecimientos traumáticos severos)
          </Text>
          <View style={styles.filaEtiquetaValor}>
            <Text style={styles.etiqueta}>Empleados evaluados</Text>
            <Text style={styles.valor}>{datos.gr1.evaluados}</Text>
          </View>
          <View style={styles.filaEtiquetaValor}>
            <Text style={styles.etiqueta}>Requieren valoración clínica</Text>
            <Text style={styles.valor}>
              {datos.gr1.requierenValoracion === null
                ? '— (n<3)'
                : String(datos.gr1.requierenValoracion)}
            </Text>
          </View>
        </View>

        {/* d) Conclusiones */}
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>d) Conclusiones</Text>
          {datos.conclusiones.map((c, i) => (
            <Text key={i} style={styles.listaItem}>
              • {c}
            </Text>
          ))}
        </View>

        {/* e) Recomendaciones y acciones de intervención */}
        <View style={styles.seccion} break={datos.acciones.length > 3}>
          <Text style={styles.tituloSeccion}>e) Recomendaciones y acciones de intervención</Text>
          {datos.acciones.length === 0 ? (
            <Text>No se registraron acciones de intervención para este ciclo.</Text>
          ) : (
            <View style={styles.tabla}>
              <View style={styles.filaTabla}>
                <Text style={styles.celdaEncabezado}>Descripción</Text>
                <Text style={styles.celdaEncabezado}>Nivel de origen</Text>
                <Text style={styles.celdaEncabezado}>Responsable</Text>
                <Text style={styles.celdaEncabezado}>Fecha compromiso</Text>
                <Text style={styles.celdaEncabezado}>Estatus</Text>
              </View>
              {datos.acciones.map((a, i) => (
                <View
                  key={i}
                  style={
                    i === datos.acciones.length - 1 ? styles.filaTablaUltima : styles.filaTabla
                  }
                >
                  <Text style={styles.celdaValor}>{a.descripcion}</Text>
                  <Text style={styles.celdaValor}>
                    {ETIQUETAS_NIVEL[a.nivelOrigen] ?? a.nivelOrigen}
                  </Text>
                  <Text style={styles.celdaValor}>{a.responsable}</Text>
                  <Text style={styles.celdaValor}>{a.fechaCompromiso ?? 'Sin definir'}</Text>
                  <Text style={styles.celdaValor}>{a.estatus}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* f) Datos del evaluador y g) fecha de evaluación */}
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>f) Datos del evaluador y g) fecha de evaluación</Text>
          <View style={styles.filaEtiquetaValor}>
            <Text style={styles.etiqueta}>Evaluador</Text>
            <Text style={styles.valor}>{datos.ciclo.evaluadorNombre}</Text>
          </View>
          <View style={styles.filaEtiquetaValor}>
            <Text style={styles.etiqueta}>Cédula profesional</Text>
            <Text style={styles.valor}>{datos.ciclo.evaluadorCedula ?? 'No especificada'}</Text>
          </View>
          <View style={styles.filaEtiquetaValor}>
            <Text style={styles.etiqueta}>Fecha de inicio</Text>
            <Text style={styles.valor}>{datos.ciclo.fechaInicio}</Text>
          </View>
          <View style={styles.filaEtiquetaValor}>
            <Text style={styles.etiqueta}>Fecha de fin</Text>
            <Text style={styles.valor}>{datos.ciclo.fechaFin ?? 'En curso'}</Text>
          </View>
        </View>

        <Text
          style={styles.pie}
          render={({ pageNumber, totalPages }) =>
            `Motor de cálculo NOM-035 v${datos.motorVersion} · Generado el ${datos.generadoEl} · ` +
            'La integridad de este documento se verifica mediante el hash SHA-256 registrado en ' +
            `el expediente de inspección (no incluido en el PDF) · Página ${pageNumber} de ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
