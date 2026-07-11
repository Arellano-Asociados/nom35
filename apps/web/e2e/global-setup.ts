import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

// Seed de datos E2E: una empresa con asignaciones para los tres tipos de guía y un enlace
// expirado. Cada corrida usa tokens únicos (las tablas de evidencia son append-only).

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export default async function globalSetup(): Promise<void> {
  const corrida = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const tokens = {
    gr3: `e2e-${corrida}-gr3`,
    gr2: `e2e-${corrida}-gr2`,
    gr1SinEvento: `e2e-${corrida}-gr1-sin`,
    gr1ConEvento: `e2e-${corrida}-gr1-con`,
    expirado: `e2e-${corrida}-exp`,
  };

  const cliente = new pg.Client({ connectionString: DB_URL });
  await cliente.connect();
  try {
    const companyId = randomUUID();
    const workCenterId = randomUUID();
    const cycleId = randomUUID();

    await cliente.query(
      `insert into companies (id, legal_name, privacy_notice_version) values ($1, $2, 'v1-e2e')`,
      [companyId, `Empresa E2E ${corrida}`],
    );
    await cliente.query(
      `insert into work_centers (id, company_id, name, headcount) values ($1, $2, 'Centro E2E', 180)`,
      [workCenterId, companyId],
    );
    await cliente.query(
      `insert into compliance_cycles (id, company_id, work_center_id, name, date_start, evaluator_name, evaluator_license)
       values ($1, $2, $3, 'Ciclo E2E', current_date, 'Evaluador E2E', 'CED-E2E')`,
      [cycleId, companyId, workCenterId],
    );

    const guias = new Map<string, string>();
    const { rows } = await cliente.query(`select id, code from questionnaires`);
    for (const fila of rows) guias.set(fila.code, fila.id);

    const asignaciones: { token: string; guia: string; vence: string }[] = [
      { token: tokens.gr3, guia: 'GR-III', vence: `now() + interval '7 days'` },
      { token: tokens.gr2, guia: 'GR-II', vence: `now() + interval '7 days'` },
      { token: tokens.gr1SinEvento, guia: 'GR-I', vence: `now() + interval '7 days'` },
      { token: tokens.gr1ConEvento, guia: 'GR-I', vence: `now() + interval '7 days'` },
      { token: tokens.expirado, guia: 'GR-III', vence: `now() - interval '1 day'` },
    ];

    for (const [i, asignacion] of asignaciones.entries()) {
      const employeeId = randomUUID();
      await cliente.query(
        `insert into employees (id, company_id, work_center_id, full_name, email)
         values ($1, $2, $3, $4, $5)`,
        [
          employeeId,
          companyId,
          workCenterId,
          `Empleado E2E ${i}`,
          `e2e-${corrida}-${i}@example.com`,
        ],
      );
      await cliente.query(
        `insert into questionnaire_assignments
           (company_id, cycle_id, employee_id, questionnaire_id, token_hash, expires_at)
         values ($1, $2, $3, $4, $5, ${asignacion.vence})`,
        [companyId, cycleId, employeeId, guias.get(asignacion.guia), hash(asignacion.token)],
      );
    }

    writeFileSync(
      join(__dirname, '.datos-e2e.json'),
      JSON.stringify({ tokens, companyId }, null, 2),
    );
  } finally {
    await cliente.end();
  }
}
