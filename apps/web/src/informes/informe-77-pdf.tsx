import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CeldaAgregado, Distribucion } from '../lib/agregados';
import type { DatosInforme77 } from '../lib/informe';

// Plantilla del informe de resultados del numeral 7.7 de la NOM-035-STPS-2018.
// (El 7.9 es la PERIODICIDAD bienal de la evaluación, no el informe: ver alerta de ciclo.)
//
// NO es un componente cliente de Next.js: vive fuera de `app/` y se ejecuta
// del lado servidor con `@react-pdf/renderer`, una implementación de React
// independiente del DOM/navegador que renderiza a PDF (Helvetica soporta
// acentos/es-MX de forma nativa, sin fuentes externas).
//
// Contiene ÚNICAMENTE datos ya agregados en `DatosInforme77` (regla inviolable
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

/**
 * Objetivo del informe (7.7 b), DETERMINISTA a partir de las guías efectivamente
 * aplicadas: el alcance normativo lo fija la categoría del centro (numerales 7.1 a 7.3).
 * Solo los centros de más de 50 trabajadores (GR-III) evalúan además el entorno
 * organizacional; afirmarlo en un centro que no lo evaluó sería falsear el informe.
 */
export function objetivoDeGuias(guias: readonly string[]): string {
  const evaluaEntorno = guias.includes('GR-III');
  const identifica =
    'Identificar y analizar los factores de riesgo psicosocial presentes en el centro de trabajo';
  return evaluaEntorno
    ? `${identifica} y evaluar el entorno organizacional, conforme a los numerales 7.1, 7.2 y 7.3 de la NOM-035-STPS-2018, para determinar el nivel de riesgo y las acciones que correspondan.`
    : `${identifica}, conforme a los numerales 7.1 y 7.2 de la NOM-035-STPS-2018, para determinar el nivel de riesgo y las acciones que correspondan.`;
}

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

// Node 22 (runtime objetivo de CI/Vercel) trae ICU completo por defecto (full-icu),
// así que los datos de la locale es-MX están disponibles sin configuración adicional
// (sin necesidad de --icu-data-dir ni del paquete full-icu).
// La zona horaria es configurable por organización (Fase 3, company_settings);
// default sensato: America/Mexico_City. El formatter se crea por render porque
// depende de datos, no de una constante.
function formatoFechaPie(timezone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: timezone,
    });
  } catch {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' });
  }
}

// `datos.generadoEl` permanece ISO en `DatosInforme77` (no se reformatea en el tipo ni en
// las acciones de servidor): el formateo es puramente de presentación, al renderizar.
function formatearFechaPie(iso: string, timezone: string): string {
  return formatoFechaPie(timezone).format(new Date(iso));
}

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

export function Informe77Pdf({ datos }: { datos: DatosInforme77 }) {
  return (
    <Document
      title={`Informe NOM-035 numeral 7.7 — ${datos.empresa.razonSocial}`}
      author="Constata — Cumplimiento NOM-035-STPS-2018"
    >
      <Page size="LETTER" style={styles.page}>
        <View
          style={[styles.encabezado, { flexDirection: 'row', justifyContent: 'space-between' }]}
        >
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.tituloInforme}>
              Informe de resultados — Numeral 7.7 NOM-035-STPS-2018
            </Text>
            <Text style={styles.subtituloInforme}>
              {datos.empresa.razonSocial} — RFC: {datos.empresa.rfc || 'No especificado'}
            </Text>
          </View>
          {/* Logo del cliente JUNTO A la marca Constata (que firma el pie), nunca en su
              lugar (indicación del propietario, Fase 3). Data URI validado por magic bytes. */}
          {datos.personalizacion?.logoDataUri && (
            <Image
              src={datos.personalizacion.logoDataUri}
              style={{ height: 32, maxWidth: 120, objectFit: 'contain' }}
            />
          )}
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

        {/* b) Objetivo — determinista según las guías efectivamente aplicadas (7.1/7.2/7.3) */}
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>b) Objetivo de la evaluación</Text>
          <Text>{objetivoDeGuias([...new Set(datos.centros.flatMap((c) => c.guias))])}</Text>
        </View>

        {/* c) Principales actividades del centro de trabajo */}
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>c) Principales actividades del centro de trabajo</Text>
          {datos.centros.map((centro) => (
            <View key={centro.nombre} style={styles.filaEtiquetaValor}>
              <Text style={styles.etiqueta}>{centro.nombre}</Text>
              <Text style={styles.valor}>{centro.actividad || 'No especificada'}</Text>
            </View>
          ))}
        </View>

        {/* d) Método utilizado — incluye la forma de aplicación del 7.4 b) a d) */}
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>d) Método utilizado</Text>
          <Text>
            Guías de referencia aplicadas:{' '}
            {[...new Set(datos.centros.flatMap((c) => c.guias))].join(', ') || 'No especificado'}.
          </Text>
          <Text style={{ marginTop: 4 }}>
            Forma de aplicación (numeral 7.4): los cuestionarios se aplicaron a la totalidad de los
            trabajadores del centro (censo, no muestra), de forma individual y electrónica mediante
            un enlace personal, y en condiciones que garantizan la confidencialidad de las
            respuestas: ninguna persona del centro de trabajo tiene acceso a las respuestas
            individuales, que se procesan de forma automatizada.
          </Text>
          <Text style={{ marginTop: 4 }}>
            Ciclo de evaluación: {datos.ciclo.nombre}. Cuestionarios asignados:{' '}
            {datos.participacion.asignados}; cuestionarios completados:{' '}
            {datos.participacion.completados}.
          </Text>
        </View>

        {/* e) Resultados obtenidos */}
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>e) Resultados obtenidos</Text>
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

        {/* f) Conclusiones — incluye la integración al diagnóstico de SST (7.6 / NOM-030) */}
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>f) Conclusiones</Text>
          {datos.conclusiones.map((c, i) => (
            <Text key={i} style={styles.listaItem}>
              • {c}
            </Text>
          ))}
        </View>

        {/* g) Recomendaciones y acciones de intervención */}
        <View style={styles.seccion} break={datos.acciones.length > 3}>
          <Text style={styles.tituloSeccion}>g) Recomendaciones y acciones de intervención</Text>
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

        {/* h) Datos del evaluador e i) fecha de evaluación */}
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>h) Datos del evaluador e i) fecha de evaluación</Text>
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
          {(datos.personalizacion?.contactoNombre || datos.personalizacion?.contactoCorreo) && (
            <View style={styles.filaEtiquetaValor}>
              <Text style={styles.etiqueta}>Contacto</Text>
              <Text style={styles.valor}>
                {[
                  datos.personalizacion?.contactoNombre,
                  datos.personalizacion?.contactoCorreo,
                  datos.personalizacion?.contactoTelefono,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          )}
        </View>

        <Text
          style={styles.pie}
          render={({ pageNumber, totalPages }) =>
            `Constata · Motor de cálculo NOM-035 v${datos.motorVersion} · ` +
            `Generado el ${formatearFechaPie(
              datos.generadoEl,
              datos.personalizacion?.timezone ?? 'America/Mexico_City',
            )} · ` +
            'La integridad de este documento se verifica mediante el hash SHA-256 registrado en ' +
            `el expediente de inspección (no incluido en el PDF) · Página ${pageNumber} de ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
