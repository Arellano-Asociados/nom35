import { describe, expect, it } from 'vitest';
import {
  csvRegistro58a,
  csvRegistro58c,
  filasRegistro58a,
  type FilaResultado58a,
  type EntradaRegistro58c,
} from './registros-58';

// Registros del numeral 5.8: son evidencia exhibible ante la STPS y contienen datos de
// salud POR PERSONA. Aquí solo se prueba el ARMADO puro (columnas, vigencia, escapado);
// la autorización del RD y la auditoría fail-closed viven en acciones/registros.ts.

const texto = (b: Buffer) => b.toString('utf-8');

const RESULTADO_BASE: FilaResultado58a = {
  id: 'r1',
  assignmentId: 'a1',
  supersedesId: null,
  createdAt: '2026-03-01T10:00:00.000Z',
  nombreEmpleado: 'Ana López',
  nombreCentro: 'Planta Norte',
  guia: 'GR-III',
  cfinal: 84,
  nivelFinal: 'medio',
  categorias: [
    { nombre: 'Ambiente de trabajo', nivel: 'bajo' },
    { nombre: 'Carga de trabajo', nivel: 'alto' },
  ],
  dominios: [{ nombre: 'Condiciones en el ambiente de trabajo', nivel: 'nulo' }],
  versionMotor: '0.2.0',
};

describe('registro 5.8 a) — resultados por trabajador', () => {
  it('emite las columnas del registro, con categorías y dominios compactados', () => {
    const csv = texto(csvRegistro58a([RESULTADO_BASE]));
    const [cabecera, fila] = csv.replace('﻿', '').trim().split('\r\n');
    expect(cabecera).toBe(
      'empleado,centro_trabajo,cuestionario,calificacion_final,nivel_final,niveles_por_categoria,niveles_por_dominio,fecha,version_motor',
    );
    // El compactado separa con "; " (no con coma): por eso NO necesita entrecomillado
    // RFC 4180 y el campo viaja tal cual. Un separador con coma habría duplicado columnas.
    expect(fila).toBe(
      'Ana López,Planta Norte,GR-III,84,medio,' +
        'Ambiente de trabajo=bajo; Carga de trabajo=alto,' +
        'Condiciones en el ambiente de trabajo=nulo,2026-03-01T10:00:00.000Z,0.2.0',
    );
  });

  it('incluye SOLO el resultado vigente de cada asignación (recálculo = fila nueva)', () => {
    // Regla inviolable 1: el recálculo no edita, agrega una fila con supersedes_id.
    // El registro que se exhibe ante la STPS debe traer el vigente, no el historial.
    const viejo: FilaResultado58a = {
      ...RESULTADO_BASE,
      id: 'r0',
      cfinal: 120,
      nivelFinal: 'alto',
    };
    const nuevo: FilaResultado58a = {
      ...RESULTADO_BASE,
      id: 'r1',
      supersedesId: 'r0',
      createdAt: '2026-04-01T10:00:00.000Z',
    };
    const filas = filasRegistro58a([viejo, nuevo]);
    expect(filas).toHaveLength(1);
    expect(filas[0].id).toBe('r1');
    expect(filas[0].nivelFinal).toBe('medio');
  });

  it('neutraliza fórmulas en el nombre del empleado (CSV injection)', () => {
    const csv = texto(
      csvRegistro58a([{ ...RESULTADO_BASE, nombreEmpleado: '=HYPERLINK("http://malo","x")' }]),
    );
    expect(csv).toContain('"\'=HYPERLINK(""http://malo"",""x"")"');
    expect(csv).not.toContain(',=HYPERLINK');
  });
});

describe('registro 5.8 c) — trabajadores examinados y canalizados', () => {
  const BASE: EntradaRegistro58c = {
    nombreEmpleado: 'Beto Ruiz',
    nombreCentro: 'Planta Norte',
    origen: 'Ciclo 2026',
    esEventoTraumatico: false,
    presentoAcontecimiento: true,
    requiereValoracion: true,
    estatusCanalizacion: 'canalizado',
    fechaCanalizacion: '2026-03-05T00:00:00.000Z',
  };

  it('emite las columnas del registro con Sí/No legibles', () => {
    const csv = texto(csvRegistro58c([BASE]));
    const [cabecera, fila] = csv.replace('﻿', '').trim().split('\r\n');
    expect(cabecera).toBe(
      'empleado,centro_trabajo,origen,presento_acontecimiento,requiere_valoracion,estatus_canalizacion,fecha_canalizacion',
    );
    expect(fila).toBe(
      'Beto Ruiz,Planta Norte,Ciclo 2026,Sí,Sí,canalizado,2026-03-05T00:00:00.000Z',
    );
  });

  it('distingue el origen: ciclo ordinario vs. acontecimiento traumático', () => {
    // El 5.8 c) es del CENTRO DE TRABAJO, no de un ciclo: el registro abarca ambas vías
    // de aplicación de la GR-I y debe decir de cuál viene cada renglón.
    const csv = texto(
      csvRegistro58c([
        BASE,
        {
          ...BASE,
          nombreEmpleado: 'Caro Díaz',
          origen: 'Acontecimiento traumático del 10/07/2026',
          esEventoTraumatico: true,
          estatusCanalizacion: null,
          fechaCanalizacion: null,
        },
      ]),
    );
    const filas = csv.replace('﻿', '').trim().split('\r\n').slice(1);
    expect(filas[0]).toContain('Ciclo 2026');
    expect(filas[1]).toContain('Acontecimiento traumático del 10/07/2026');
    // Sin canalización aún: columnas vacías, jamás inventadas
    expect(filas[1].endsWith(',,')).toBe(true);
  });

  it('escribe "No" cuando el trabajador no presentó acontecimiento', () => {
    const csv = texto(
      csvRegistro58c([{ ...BASE, presentoAcontecimiento: false, requiereValoracion: false }]),
    );
    expect(csv).toContain('Planta Norte,Ciclo 2026,No,No,');
  });
});
