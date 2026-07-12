import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  armarExpediente,
  type EntradaAcusePolitica,
  type EntradaCapacitacion,
  type EntradaExpediente,
  type EntradaParticipacionCentro,
  type EntradaResumenAuditoria,
} from './expediente';

// Cubre el Step 1 de Task 5: (a) contenido del ZIP, (b) sha256 del manifiesto vs bytes
// reales, (c) frontera anti-reidentificación en los CSVs (regla inviolable 4: nada
// patronal ve respuestas/resultados crudos; aquí ni siquiera se cuela un nivel de
// riesgo por empleado), (d) política ausente no truena y se marca explícitamente.

const PDF_DE_PRUEBA = Buffer.from('%PDF-1.4 contenido de prueba', 'utf-8');

const DATOS_BASE: EntradaExpediente['datos'] = {
  empresa: { razonSocial: 'Acme, S.A. de "C.V."', rfc: 'ACM010101AAA' },
  ciclo: {
    nombre: 'Ciclo 2026',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-03-01',
    evaluadorNombre: 'Jane Doe',
    evaluadorCedula: '12345678',
  },
  acciones: [
    {
      descripcion: 'Capacitación en manejo de carga de trabajo.',
      nivelOrigen: 'medio',
      responsable: 'Responsable Designado',
      fechaCompromiso: '2026-06-01',
      estatus: 'pendiente',
    },
  ],
};

const ACUSES: EntradaAcusePolitica[] = [
  {
    nombreEmpleado: 'José Pérez, "El Jefe"',
    tituloPolitica: 'Política de Prevención de Riesgos Psicosociales, 2026',
    versionPolitica: '2.1',
    fechaAcuse: '2026-02-01T10:00:00.000Z',
  },
  {
    nombreEmpleado: 'María López',
    tituloPolitica: 'Política de Prevención',
    versionPolitica: '1.0',
    fechaAcuse: '2026-02-02T10:00:00.000Z',
  },
];

const PARTICIPACION: EntradaParticipacionCentro[] = [
  { nombreCentro: 'Centro Norte', asignados: 10, completados: 8 },
];

const CAPACITACION: EntradaCapacitacion[] = [
  {
    nombreEmpleado: 'María López',
    nombreCapacitacion: 'Prevención de riesgos psicosociales',
    fechaCompletado: '2026-03-01T00:00:00.000Z',
    estatus: 'completado',
  },
];

const RESUMEN_AUDITORIA: EntradaResumenAuditoria[] = [
  { eventType: 'informe_generado', conteo: 2 },
  { eventType: 'expediente_generado', conteo: 1 },
];

function entradaCompleta(overrides?: Partial<EntradaExpediente>): EntradaExpediente {
  return {
    datos: DATOS_BASE,
    pdfInforme: PDF_DE_PRUEBA,
    politica: { nombreArchivo: 'politica-2026.pdf', bytes: Buffer.from('bytes de política') },
    acusesPolitica: ACUSES,
    participacion: PARTICIPACION,
    capacitacion: CAPACITACION,
    resumenAuditoria: RESUMEN_AUDITORIA,
    generadoEl: '2026-07-11T12:00:00.000Z',
    ...overrides,
  };
}

describe('armarExpediente', () => {
  it('(a) el ZIP contiene manifiesto.json, informe-7-9.pdf y los CSVs esperados', async () => {
    const { zip } = await armarExpediente(entradaCompleta());
    const leido = await JSZip.loadAsync(zip);

    expect(Object.keys(leido.files).sort()).toEqual(
      [
        'manifiesto.json',
        'informe-7-9.pdf',
        'politica-prevencion.pdf',
        'acuses-politica.csv',
        'participacion.csv',
        'acciones.csv',
        'capacitacion.csv',
        'resumen-auditoria.csv',
      ].sort(),
    );
  });

  it('(b) el sha256 de cada archivo del manifiesto coincide con los bytes reales en el ZIP', async () => {
    const { zip, manifiesto } = await armarExpediente(entradaCompleta());
    const leido = await JSZip.loadAsync(zip);

    expect(manifiesto.archivos.length).toBeGreaterThan(0);
    for (const archivo of manifiesto.archivos) {
      const entrada = leido.file(archivo.nombre);
      expect(entrada).not.toBeNull();
      const bytesReales = await entrada!.async('nodebuffer');
      expect(bytesReales.length).toBe(archivo.bytes);
      const shaReal = createHash('sha256').update(bytesReales).digest('hex');
      expect(shaReal).toBe(archivo.sha256);
    }
  });

  it('(c) los CSVs ligados a empleados NO traen niveles de riesgo ni resultados', async () => {
    const { zip } = await armarExpediente(entradaCompleta());
    const leido = await JSZip.loadAsync(zip);

    const acuses = await leido.file('acuses-politica.csv')!.async('string');
    const participacion = await leido.file('participacion.csv')!.async('string');
    const capacitacion = await leido.file('capacitacion.csv')!.async('string');
    const resumenAuditoria = await leido.file('resumen-auditoria.csv')!.async('string');

    // Cabeceras exactas: ninguna columna de resultado/nivel de riesgo.
    expect(acuses.replace(/^\uFEFF/, '').split('\r\n')[0]).toBe(
      'empleado,politica,version,fecha_acuse',
    );
    expect(participacion.replace(/^\uFEFF/, '').split('\r\n')[0]).toBe(
      'centro_trabajo,cuestionarios_asignados,cuestionarios_completados',
    );
    expect(capacitacion.replace(/^\uFEFF/, '').split('\r\n')[0]).toBe(
      'empleado,capacitacion,fecha_completado,estatus',
    );
    // resumen-auditoria.csv: solo evento + conteo, sin actor_id/entity_id/detalles (no
    // tiene ligadura a empleado alguno, pero se cubre la misma frontera anti-reidentificación).
    expect(resumenAuditoria.replace(/^\uFEFF/, '').split('\r\n')[0]).toBe('evento,conteo');

    // Ningún nivel de riesgo del motor debe aparecer como dato en estos archivos
    // (frontera anti-reidentificación: son evidencia de proceso, no de resultado).
    const NIVELES_PROHIBIDOS = /\b(nulo|bajo|medio|alto|muy_alto|muy alto)\b/i;
    for (const contenido of [acuses, participacion, capacitacion, resumenAuditoria]) {
      expect(contenido).not.toMatch(NIVELES_PROHIBIDOS);
    }
  });

  it('(e) resumen-auditoria.csv trae evento + conteo de cada tipo, sin más columnas', async () => {
    const { zip } = await armarExpediente(entradaCompleta());
    const leido = await JSZip.loadAsync(zip);

    const contenido = await leido.file('resumen-auditoria.csv')!.async('string');
    const lineas = contenido
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .filter(Boolean);

    expect(lineas[0]).toBe('evento,conteo');
    expect(lineas[1]).toBe('informe_generado,2');
    expect(lineas[2]).toBe('expediente_generado,1');
    expect(lineas.length).toBe(3);
  });

  it('(d) sin política publicada, el manifiesto la marca "ausente" y el ZIP no truena', async () => {
    const { zip, manifiesto } = await armarExpediente(entradaCompleta({ politica: null }));
    const leido = await JSZip.loadAsync(zip);

    expect(manifiesto.politicaPublicada).toBe('ausente');
    expect(Object.keys(leido.files).some((n) => n.startsWith('politica-prevencion'))).toBe(false);
    // El resto del expediente se genera igual.
    expect(leido.file('manifiesto.json')).not.toBeNull();
    expect(leido.file('informe-7-9.pdf')).not.toBeNull();
  });

  it('escapa correctamente comas, comillas y acentos en los campos CSV', async () => {
    const { zip } = await armarExpediente(entradaCompleta());
    const leido = await JSZip.loadAsync(zip);
    const acuses = await leido.file('acuses-politica.csv')!.async('string');
    const lineas = acuses
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .filter(Boolean);

    // 'José Pérez, "El Jefe"' trae coma y comillas: debe ir entre comillas dobles con
    // las comillas internas escapadas como "" (RFC 4180), y el acento debe preservarse.
    expect(lineas[1]).toBe(
      '"José Pérez, ""El Jefe""","Política de Prevención de Riesgos Psicosociales, 2026",2.1,2026-02-01T10:00:00.000Z',
    );
  });

  it('neutraliza inyección de fórmulas: campos que inician con =, +, -, @ llevan apóstrofo antepuesto', async () => {
    const entrada = entradaCompleta({
      acusesPolitica: [
        {
          nombreEmpleado: '=HYPERLINK("http://evil.com","x")',
          tituloPolitica: 'Política de Prevención',
          versionPolitica: '1.0',
          fechaAcuse: '2026-02-01T10:00:00.000Z',
        },
        {
          nombreEmpleado: '+1234',
          tituloPolitica: 'Política de Prevención',
          versionPolitica: '1.0',
          fechaAcuse: '2026-02-02T10:00:00.000Z',
        },
        {
          nombreEmpleado: '-5',
          tituloPolitica: 'Política de Prevención',
          versionPolitica: '1.0',
          fechaAcuse: '2026-02-03T10:00:00.000Z',
        },
        {
          nombreEmpleado: '@SUM(A1)',
          tituloPolitica: 'Política de Prevención',
          versionPolitica: '1.0',
          fechaAcuse: '2026-02-04T10:00:00.000Z',
        },
        {
          nombreEmpleado: 'María López',
          tituloPolitica: 'Política de Prevención',
          versionPolitica: '1.0',
          fechaAcuse: '2026-02-05T10:00:00.000Z',
        },
      ],
    });
    const { zip } = await armarExpediente(entrada);
    const leido = await JSZip.loadAsync(zip);
    const acuses = await leido.file('acuses-politica.csv')!.async('string');
    const lineas = acuses
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .filter(Boolean);

    // Cabecera intacta: ninguna columna inicia con =, +, -, @.
    expect(lineas[0]).toBe('empleado,politica,version,fecha_acuse');
    // '=HYPERLINK(...)' trae coma y comillas dobles: recibe AMBOS tratamientos, el
    // apóstrofo de neutralización Y el entrecomillado RFC 4180 (con "" internas).
    expect(lineas[1]).toBe(
      '"\'=HYPERLINK(""http://evil.com"",""x"")",Política de Prevención,1.0,2026-02-01T10:00:00.000Z',
    );
    // '+', '-', '@' sin coma/comillas: solo el apóstrofo, sin entrecomillado.
    expect(lineas[2]).toBe("'+1234,Política de Prevención,1.0,2026-02-02T10:00:00.000Z");
    expect(lineas[3]).toBe("'-5,Política de Prevención,1.0,2026-02-03T10:00:00.000Z");
    expect(lineas[4]).toBe("'@SUM(A1),Política de Prevención,1.0,2026-02-04T10:00:00.000Z");
    // Campo normal y fecha ISO (inicia con dígito): sin cambios.
    expect(lineas[5]).toBe('María López,Política de Prevención,1.0,2026-02-05T10:00:00.000Z');
  });

  it('neutraliza inyección de fórmulas: campos que inician con tab (\\t) o retorno de carro (\\r) también llevan apóstrofo antepuesto', async () => {
    const entrada = entradaCompleta({
      acusesPolitica: [
        {
          nombreEmpleado: '\tEmpleado con tab',
          tituloPolitica: 'Política de Prevención',
          versionPolitica: '1.0',
          fechaAcuse: '2026-02-01T10:00:00.000Z',
        },
        {
          nombreEmpleado: '\rEmpleado con cr',
          tituloPolitica: 'Política de Prevención',
          versionPolitica: '1.0',
          fechaAcuse: '2026-02-02T10:00:00.000Z',
        },
      ],
    });
    const { zip } = await armarExpediente(entrada);
    const leido = await JSZip.loadAsync(zip);
    const acuses = await leido.file('acuses-politica.csv')!.async('string');
    const lineas = acuses.replace(/^\uFEFF/, '').split('\r\n');

    // '\t'-prefijado: sin coma/comilla/CR/LF, solo recibe el apóstrofo de neutralización
    // (sin entrecomillado RFC 4180).
    expect(lineas[1]).toBe(
      "'\tEmpleado con tab,Política de Prevención,1.0,2026-02-01T10:00:00.000Z",
    );
    // '\r'-prefijado: recibe AMBOS tratamientos — el apóstrofo de neutralización Y el
    // entrecomillado RFC 4180 (el \r embebido dispara la regla de comillas de esta
    // implementación, aunque no traiga coma ni comilla).
    expect(lineas[2]).toBe(
      '"\'\rEmpleado con cr",Política de Prevención,1.0,2026-02-02T10:00:00.000Z',
    );
  });

  it('el manifiesto incluye contexto de empresa/ciclo y fecha de generación', async () => {
    const { manifiesto } = await armarExpediente(entradaCompleta());
    expect(manifiesto.empresa).toBe('Acme, S.A. de "C.V."');
    expect(manifiesto.ciclo).toBe('Ciclo 2026');
    expect(manifiesto.generadoEl).toBe('2026-07-11T12:00:00.000Z');
    expect(manifiesto.politicaPublicada).toBe('presente');
  });
});
