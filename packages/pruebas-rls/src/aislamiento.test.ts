import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Suite de aislamiento multi-tenant — GATE DE CI (regla inviolable 6).
// Corre contra el Postgres de Supabase local (supabase db start) con las migraciones aplicadas.
// Simula usuarios reales: SET LOCAL ROLE authenticated + claims JWT en request.jwt.claims,
// exactamente como lo hace PostgREST.

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const TENANT_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-4000-8000-000000000001';
const ADMIN_A = '11111111-0000-4000-8000-000000000001';
const DR_A = '11111111-0000-4000-8000-000000000002';
const CONSULTOR_A = '11111111-0000-4000-8000-000000000003';
const EMPLEADO_A1 = '11111111-0000-4000-8000-000000000004';
const ADMIN_B = '22222222-0000-4000-8000-000000000001';
const CONSULTOR_LIBRE = '33333333-0000-4000-8000-000000000001';
const WC_A1 = 'aaaaaaaa-0000-4000-8000-000000000011';
const EMP_A1 = 'aaaaaaaa-0000-4000-8000-000000000021';
const QA_A1 = 'aaaaaaaa-0000-4000-8000-000000000061';
const QA_A2 = 'aaaaaaaa-0000-4000-8000-000000000062';
const RESP_A = 'aaaaaaaa-0000-4000-8000-000000000081';
const RR_A = 'aaaaaaaa-0000-4000-8000-000000000091';
const GR1_A = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const AUDIT_A = 'aaaaaaaa-0000-4000-8000-000000000111';

const TABLAS_GLOBALES = [
  'questionnaires',
  'questions',
  'scoring_rules',
  'item_structure',
  'risk_level_ranges',
  'platform_users',
  'system_config',
];

let pool: pg.Pool;
let tablasTenant: string[] = [];

type Consulta = (sql: string, params?: unknown[]) => Promise<pg.QueryResult>;

/** Ejecuta consultas como un usuario autenticado con los claims dados; todo en una
 * transacción que se revierte al final. */
async function como(
  claims: { sub: string; company_id?: string },
  fn: (q: Consulta) => Promise<void>,
  rol: 'authenticated' | 'anon' = 'authenticated',
): Promise<void> {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    await cliente.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ role: rol, ...claims }),
    ]);
    await cliente.query(`set local role ${rol}`);
    await fn((sql, params) => cliente.query(sql, params));
  } finally {
    await cliente.query('rollback');
    cliente.release();
  }
}

/** Ejecuta como postgres (dueño de las tablas: RLS no aplica, los triggers sí);
 * transacción revertida al final. */
async function comoPostgres(fn: (q: Consulta) => Promise<void>): Promise<void> {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    await fn((sql, params) => cliente.query(sql, params));
  } finally {
    await cliente.query('rollback');
    cliente.release();
  }
}

async function contar(q: Consulta, sql: string, params?: unknown[]): Promise<number> {
  const r = await q(sql, params);
  return Number(r.rows[0].n);
}

/** Ejecuta una operación que puede ser bloqueada por privilegios o RLS, aislada en un
 * savepoint para no abortar la transacción. Devuelve filas afectadas y código de error. */
async function intento(
  q: Consulta,
  sql: string,
  params?: unknown[],
): Promise<{ filas: number; rows: Record<string, unknown>[]; codigo?: string }> {
  await q('savepoint intento');
  try {
    const r = await q(sql, params);
    await q('release savepoint intento');
    return { filas: r.rowCount ?? 0, rows: r.rows };
  } catch (e) {
    await q('rollback to savepoint intento');
    return { filas: 0, rows: [], codigo: (e as { code?: string }).code ?? 'sin_codigo' };
  }
}

/** La operación DEBE quedar bloqueada: o afecta 0 filas o falla con 42501
 * (violación de RLS / privilegio denegado). */
async function esperarBloqueo(q: Consulta, sql: string, params?: unknown[], etiqueta?: string) {
  const r = await intento(q, sql, params);
  if (r.codigo !== undefined) {
    expect(r.codigo, etiqueta ?? sql).toBe('42501');
  } else {
    expect(r.filas, etiqueta ?? sql).toBe(0);
  }
}

/** La operación DEBE fallar con 42501 (no basta con 0 filas: es un INSERT). */
async function esperarRechazo(q: Consulta, sql: string, params?: unknown[], etiqueta?: string) {
  const r = await intento(q, sql, params);
  expect(r.codigo, etiqueta ?? sql).toBe('42501');
}

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: DB_URL, max: 2 });
  const fixtures = readFileSync(fileURLToPath(new URL('./fixtures.sql', import.meta.url)), 'utf-8');
  await pool.query(fixtures);
  const r = await pool.query(`
    select c.relname as tabla
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'company_id' and not a.attisdropped
      )
    order by 1
  `);
  tablasTenant = r.rows.map((f: { tabla: string }) => f.tabla);
});

afterAll(async () => {
  await pool?.end();
});

describe('cobertura de RLS', () => {
  it('toda tabla pública es global conocida o tabla de tenant con company_id', async () => {
    const r = await pool.query(`
      select c.relname as tabla
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by 1
    `);
    const todas = r.rows.map((f: { tabla: string }) => f.tabla);
    const sinClasificar = todas.filter(
      (t) => !TABLAS_GLOBALES.includes(t) && !tablasTenant.includes(t) && t !== 'companies',
    );
    expect(sinClasificar).toEqual([]);
    expect(tablasTenant.length).toBeGreaterThanOrEqual(17);
  });

  it('TODAS las tablas públicas tienen RLS activo', async () => {
    const r = await pool.query(`
      select c.relname as tabla
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    `);
    expect(r.rows.map((f: { tabla: string }) => f.tabla)).toEqual([]);
  });
});

describe('aislamiento entre tenants (usuario del tenant A vs. filas del tenant B)', () => {
  it('admin_org de A no LEE ninguna fila de B en ninguna tabla de tenant', async () => {
    await como({ sub: ADMIN_A, company_id: TENANT_A }, async (q) => {
      expect(await contar(q, 'select count(*) n from companies where id = $1', [TENANT_B])).toBe(0);
      for (const tabla of tablasTenant) {
        // Bloqueado = 0 filas visibles o privilegio de SELECT denegado (p. ej. responses)
        const r = await intento(q, `select count(*) n from ${tabla} where company_id = $1`, [
          TENANT_B,
        ]);
        if (r.codigo !== undefined) {
          expect(r.codigo, tabla).toBe('42501');
        } else {
          expect(Number(r.rows[0]?.n), tabla).toBe(0);
        }
      }
    });
  });

  it('admin_org de A no puede ACTUALIZAR ni BORRAR filas de B', async () => {
    await como({ sub: ADMIN_A, company_id: TENANT_A }, async (q) => {
      await esperarBloqueo(q, 'update companies set legal_name = legal_name where id = $1', [
        TENANT_B,
      ]);
      for (const tabla of tablasTenant) {
        await esperarBloqueo(
          q,
          `update ${tabla} set company_id = company_id where company_id = $1`,
          [TENANT_B],
          `update ${tabla}`,
        );
        await esperarBloqueo(
          q,
          `delete from ${tabla} where company_id = $1`,
          [TENANT_B],
          `delete ${tabla}`,
        );
      }
    });
  });

  it('admin_org de A no puede INSERTAR filas con company_id de B', async () => {
    await como({ sub: ADMIN_A, company_id: TENANT_A }, async (q) => {
      await esperarRechazo(
        q,
        `insert into work_centers (company_id, name, headcount) values ($1, 'X', 10)`,
        [TENANT_B],
      );
    });
  });

  it('claims manipulados sin membresía real no dan acceso (JWT con company_id de B)', async () => {
    await como({ sub: ADMIN_A, company_id: TENANT_B }, async (q) => {
      expect(await contar(q, 'select count(*) n from companies')).toBe(0);
      expect(await contar(q, 'select count(*) n from work_centers')).toBe(0);
      expect(await contar(q, 'select count(*) n from employees')).toBe(0);
      expect(await contar(q, 'select count(*) n from risk_results')).toBe(0);
    });
  });

  it('el admin_org de A sí ve su propio tenant', async () => {
    await como({ sub: ADMIN_A, company_id: TENANT_A }, async (q) => {
      expect(await contar(q, 'select count(*) n from companies where id = $1', [TENANT_A])).toBe(1);
      expect(
        await contar(q, 'select count(*) n from work_centers where company_id = $1', [TENANT_A]),
      ).toBe(2);
      expect(
        await contar(q, 'select count(*) n from employees where company_id = $1', [TENANT_A]),
      ).toBe(2);
    });
  });
});

describe('consultores', () => {
  it('un consultor solo accede a las empresas asignadas', async () => {
    await como({ sub: CONSULTOR_A }, async (q) => {
      expect(await contar(q, 'select count(*) n from companies where id = $1', [TENANT_A])).toBe(1);
      expect(await contar(q, 'select count(*) n from companies where id = $1', [TENANT_B])).toBe(0);
      expect(
        await contar(q, 'select count(*) n from work_centers where company_id = $1', [TENANT_A]),
      ).toBe(2);
      expect(
        await contar(q, 'select count(*) n from work_centers where company_id = $1', [TENANT_B]),
      ).toBe(0);
    });
  });

  it('un consultor sin asignaciones no ve ninguna empresa', async () => {
    await como({ sub: CONSULTOR_LIBRE }, async (q) => {
      expect(await contar(q, 'select count(*) n from companies')).toBe(0);
      expect(await contar(q, 'select count(*) n from work_centers')).toBe(0);
      expect(await contar(q, 'select count(*) n from employees')).toBe(0);
    });
  });
});

describe('respuestas crudas: NADIE del lado patronal las lee (regla inviolable 4)', () => {
  it.each([
    ['admin_org de A', ADMIN_A],
    ['Responsable Designado de A', DR_A],
    ['consultor de A', CONSULTOR_A],
    ['empleado A1 (ni siquiera las propias)', EMPLEADO_A1],
  ])('%s no puede hacer SELECT sobre responses', async (_nombre, uid) => {
    await como({ sub: uid, company_id: TENANT_A }, async (q) => {
      // Sin GRANT de SELECT ni política: el bloqueo debe ser un privilegio denegado duro
      await esperarRechazo(q, 'select count(*) n from responses');
    });
  });

  it('el empleado inserta respuestas SOLO en su propio assignment vigente', async () => {
    await como({ sub: EMPLEADO_A1, company_id: TENANT_A }, async (q) => {
      const propia = await q(
        `insert into responses (company_id, assignment_id, item_number, answer)
         values ($1, $2, 2, 'nunca')`,
        [TENANT_A, QA_A1],
      );
      expect(propia.rowCount).toBe(1);
      await esperarRechazo(
        q,
        `insert into responses (company_id, assignment_id, item_number, answer)
         values ($1, $2, 2, 'nunca')`,
        [TENANT_A, QA_A2],
      );
    });
  });
});

describe('resultados individuales: solo Responsable Designado y el propio empleado', () => {
  it('el Responsable Designado de A ve risk_results y gr1_results de A, no de B', async () => {
    await como({ sub: DR_A, company_id: TENANT_A }, async (q) => {
      expect(
        await contar(q, 'select count(*) n from risk_results where company_id = $1', [TENANT_A]),
      ).toBe(1);
      expect(
        await contar(q, 'select count(*) n from gr1_results where company_id = $1', [TENANT_A]),
      ).toBe(1);
      expect(
        await contar(q, 'select count(*) n from risk_results where company_id = $1', [TENANT_B]),
      ).toBe(0);
    });
  });

  it('el admin_org NO ve resultados individuales; el DR NO administra (no ve work_centers)', async () => {
    await como({ sub: ADMIN_A, company_id: TENANT_A }, async (q) => {
      expect(await contar(q, 'select count(*) n from risk_results')).toBe(0);
      expect(await contar(q, 'select count(*) n from gr1_results')).toBe(0);
    });
    await como({ sub: DR_A, company_id: TENANT_A }, async (q) => {
      expect(await contar(q, 'select count(*) n from work_centers')).toBe(0);
    });
  });

  it('el empleado ve únicamente SU resultado procesado y SU fila de employees', async () => {
    await como({ sub: EMPLEADO_A1, company_id: TENANT_A }, async (q) => {
      const r = await q('select employee_id from risk_results');
      expect(r.rows).toEqual([{ employee_id: EMP_A1 }]);
      const e = await q('select id from employees');
      expect(e.rows).toEqual([{ id: EMP_A1 }]);
    });
  });

  it('solo el Responsable Designado actualiza la canalización GR-I', async () => {
    await como({ sub: DR_A, company_id: TENANT_A }, async (q) => {
      const u = await q(
        `update gr1_results set canalizacion_estatus = 'canalizado', canalizacion_fecha = current_date
         where id = $1`,
        [GR1_A],
      );
      expect(u.rowCount).toBe(1);
    });
    await como({ sub: ADMIN_A, company_id: TENANT_A }, async (q) => {
      const u = await q(
        `update gr1_results set canalizacion_estatus = 'canalizado' where id = $1`,
        [GR1_A],
      );
      expect(u.rowCount).toBe(0);
    });
  });
});

describe('anónimos y catálogos', () => {
  it('anon lee los catálogos normativos pero ninguna tabla de tenant', async () => {
    await como(
      { sub: '00000000-0000-4000-8000-000000000000' },
      async (q) => {
        expect(await contar(q, 'select count(*) n from questionnaires')).toBe(3);
        // Las tablas de tenant ni siquiera tienen GRANT para anon: bloqueo duro
        await esperarRechazo(q, 'select count(*) n from companies');
        await esperarRechazo(q, 'select count(*) n from work_centers');
        await esperarRechazo(q, 'select count(*) n from responses');
      },
      'anon',
    );
  });
});

describe('auditoría', () => {
  it('un usuario solo registra eventos propios en su tenant', async () => {
    await como({ sub: DR_A, company_id: TENANT_A }, async (q) => {
      const propio = await q(
        `insert into audit_log (company_id, actor_user_id, event_type, entity, entity_id)
         values ($1, $2, 'individual_result_access', 'risk_results', $3)`,
        [TENANT_A, DR_A, RR_A],
      );
      expect(propio.rowCount).toBe(1);
      await esperarRechazo(
        q,
        `insert into audit_log (company_id, actor_user_id, event_type)
         values ($1, $2, 'suplantacion')`,
        [TENANT_A, ADMIN_A],
      );
      await esperarRechazo(
        q,
        `insert into audit_log (company_id, actor_user_id, event_type)
         values ($1, $2, 'cruce-tenant')`,
        [TENANT_B, DR_A],
      );
    });
  });
});

describe('inmutabilidad a nivel de base de datos (los triggers aplican incluso al dueño)', () => {
  it('responses: UPDATE y DELETE rechazados', async () => {
    await comoPostgres(async (q) => {
      await expect(
        q(`update responses set answer = 'nunca' where id = $1`, [RESP_A]),
      ).rejects.toThrow(/append-only/);
    });
    await comoPostgres(async (q) => {
      await expect(q(`delete from responses where id = $1`, [RESP_A])).rejects.toThrow(
        /append-only/,
      );
    });
  });

  it('risk_results: UPDATE y DELETE rechazados', async () => {
    await comoPostgres(async (q) => {
      await expect(q(`update risk_results set cfinal = 0 where id = $1`, [RR_A])).rejects.toThrow(
        /append-only/,
      );
    });
    await comoPostgres(async (q) => {
      await expect(q(`delete from risk_results where id = $1`, [RR_A])).rejects.toThrow(
        /append-only/,
      );
    });
  });

  it('audit_log y consents: UPDATE rechazado', async () => {
    await comoPostgres(async (q) => {
      await expect(
        q(`update audit_log set event_type = 'x' where id = $1`, [AUDIT_A]),
      ).rejects.toThrow(/append-only/);
    });
    await comoPostgres(async (q) => {
      await expect(q(`update consents set privacy_text_version = 'v2'`)).rejects.toThrow(
        /append-only/,
      );
    });
  });

  it('gr1_results: solo los campos de canalización son actualizables', async () => {
    await comoPostgres(async (q) => {
      const ok = await q(
        `update gr1_results set canalizacion_estatus = 'atendido', canalizacion_fecha = current_date
         where id = $1`,
        [GR1_A],
      );
      expect(ok.rowCount).toBe(1);
      await expect(
        q(`update gr1_results set requiere_valoracion = false where id = $1`, [GR1_A]),
      ).rejects.toThrow(/canalizaci/);
    });
  });
});

describe('categoría normativa derivada por trigger (umbrales 15/16 y 50/51)', () => {
  it.each([
    [1, 'solo_gr1'],
    [15, 'solo_gr1'],
    [16, 'gr1_gr2'],
    [50, 'gr1_gr2'],
    [51, 'gr1_gr3'],
    [500, 'gr1_gr3'],
  ])('headcount %i → %s', async (headcount, esperado) => {
    await comoPostgres(async (q) => {
      const r = await q(
        `insert into work_centers (company_id, name, headcount) values ($1, 'tmp', $2)
         returning nom_category`,
        [TENANT_A, headcount],
      );
      expect(r.rows[0].nom_category).toBe(esperado);
    });
  });

  it('al actualizar el headcount se recalcula la categoría', async () => {
    await comoPostgres(async (q) => {
      const r = await q(
        `update work_centers set headcount = 12 where id = $1 returning nom_category`,
        [WC_A1],
      );
      expect(r.rows[0].nom_category).toBe('solo_gr1');
    });
  });
});

describe('seeds normativos', () => {
  it('las tres guías con sus preguntas placeholder', async () => {
    const r = await pool.query(`
      select q.code, count(*)::int as n from questions p
      join questionnaires q on q.id = p.questionnaire_id
      group by q.code order by q.code
    `);
    expect(r.rows).toEqual([
      { code: 'GR-I', n: 20 },
      { code: 'GR-II', n: 46 },
      { code: 'GR-III', n: 72 },
    ]);
  });

  it('scoring_rules: 20 filas, A directo y B inverso', async () => {
    expect(Number((await pool.query('select count(*) n from scoring_rules')).rows[0].n)).toBe(20);
    const r = await pool.query(`
      select q.code, s.scoring_group, s.score from scoring_rules s
      join questionnaires q on q.id = s.questionnaire_id
      where s.option_value = 'siempre' order by q.code, s.scoring_group
    `);
    expect(r.rows).toEqual([
      { code: 'GR-II', scoring_group: 'A', score: 0 },
      { code: 'GR-II', scoring_group: 'B', score: 4 },
      { code: 'GR-III', scoring_group: 'A', score: 0 },
      { code: 'GR-III', scoring_group: 'B', score: 4 },
    ]);
  });

  it('item_structure: 118 ítems; el 29 de GR-III es grupo B; 18-19 de GR-II sin categoría', async () => {
    expect(Number((await pool.query('select count(*) n from item_structure')).rows[0].n)).toBe(118);
    const g29 = await pool.query(`
      select scoring_group from item_structure i join questionnaires q on q.id = i.questionnaire_id
      where q.code = 'GR-III' and i.item_number = 29
    `);
    expect(g29.rows[0].scoring_group).toBe('B');
    const sinCat = await pool.query(`
      select i.item_number from item_structure i join questionnaires q on q.id = i.questionnaire_id
      where q.code = 'GR-II' and i.category is null order by 1
    `);
    expect(sinCat.rows.map((f: { item_number: number }) => f.item_number)).toEqual([18, 19]);
    const cond = await pool.query(`
      select i.item_number from item_structure i join questionnaires q on q.id = i.questionnaire_id
      where q.code = 'GR-III' and i.conditional = 'atiende_clientes' order by 1
    `);
    expect(cond.rows.map((f: { item_number: number }) => f.item_number)).toEqual([65, 66, 67, 68]);
  });

  it('risk_level_ranges: 16 de GR-III y 13 de GR-II; Cfinal GR-III = 50/75/99/140', async () => {
    const conteos = await pool.query(`
      select q.code, count(*)::int as n from risk_level_ranges r
      join questionnaires q on q.id = r.questionnaire_id group by q.code order by q.code
    `);
    expect(conteos.rows).toEqual([
      { code: 'GR-II', n: 13 },
      { code: 'GR-III', n: 16 },
    ]);
    const cf = await pool.query(`
      select nulo_max::int as n1, bajo_max::int as n2, medio_max::int as n3, alto_max::int as n4
      from risk_level_ranges r join questionnaires q on q.id = r.questionnaire_id
      where q.code = 'GR-III' and r.scope = 'cfinal'
    `);
    expect(cf.rows[0]).toEqual({ n1: 50, n2: 75, n3: 99, n4: 140 });
  });
});

describe('alerta de ciclo vencido (numeral 7.9)', () => {
  it('marca centros sin ciclo o con evaluación de hace más de 24 meses', async () => {
    await como({ sub: ADMIN_A, company_id: TENANT_A }, async (q) => {
      const r = await q(
        `select name, requiere_nueva_evaluacion from work_centers_alerta_ciclo order by name`,
      );
      expect(r.rows).toEqual([
        { name: 'Centro A1', requiere_nueva_evaluacion: false },
        { name: 'Centro A2 sin ciclo', requiere_nueva_evaluacion: true },
      ]);
    });
    await como({ sub: ADMIN_B, company_id: TENANT_B }, async (q) => {
      const r = await q(`select name, requiere_nueva_evaluacion from work_centers_alerta_ciclo`);
      expect(r.rows).toEqual([{ name: 'Centro B1', requiere_nueva_evaluacion: true }]);
    });
  });
});
