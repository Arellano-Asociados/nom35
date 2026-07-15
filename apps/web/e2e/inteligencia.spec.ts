import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
import pg from 'pg';

// E2E de la Fase 6 (con IA_SIMULADA=1 en el webServer): dashboard ejecutivo, resumen IA
// (borrador inconfundible → adopción → leyenda → evento en BD) y plan IA (generar →
// adoptar al programa → action_items con ai_assisted). El flag ia_asistida gobierna la
// aparición de la IA.

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const corrida = `${Date.now()}-${randomUUID().slice(0, 6)}`;
const ADMIN = { email: `ia-admin-${corrida}@e2e.mx`, password: 'Password123!Segura' };
const EMPRESA = `Empresa IA ${corrida}`;

test.describe.configure({ mode: 'serial' });

async function consultar<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[],
): Promise<T[]> {
  const cliente = new pg.Client({ connectionString: DB_URL });
  await cliente.connect();
  try {
    const { rows } = await cliente.query(sql, params);
    return rows as T[];
  } finally {
    await cliente.end();
  }
}

let companyId = '';
let cycleId = '';

/** Siembra una empresa activa con un ciclo, resultados en nivel alto (exige programa) y
 * un admin con cuenta. Devuelve nada; deja companyId/cycleId listos. */
async function sembrar() {
  const workCenter = randomUUID();
  companyId = randomUUID();
  cycleId = randomUUID();

  await consultar(
    `insert into companies (id, legal_name, status, privacy_notice_version) values ($1,$2,'active','v1')`,
    [companyId, EMPRESA],
  );
  await consultar(
    `insert into work_centers (id, company_id, name, headcount) values ($1,$2,'Centro IA',120)`,
    [workCenter, companyId],
  );
  await consultar(
    `insert into compliance_cycles (id, company_id, work_center_id, name, date_start, evaluator_name, evaluator_license)
     values ($1,$2,$3,'Ciclo IA', current_date - 5, 'Eval', 'CED-IA')`,
    [cycleId, companyId, workCenter],
  );

  const [{ id: qId }] = await consultar<{ id: string }>(
    `select id from questionnaires where code = 'GR-III'`,
    [],
  );

  // 3 resultados en nivel alto (n≥3 → semáforo no suprimido; alto → exige programa).
  for (let i = 0; i < 3; i++) {
    const emp = randomUUID();
    const asg = randomUUID();
    await consultar(
      `insert into employees (id, company_id, work_center_id, full_name, email)
       values ($1,$2,$3,$4,$5)`,
      [emp, companyId, workCenter, `Empleado IA ${i}`, `ia-${corrida}-${i}@e2e.mx`],
    );
    await consultar(
      `insert into questionnaire_assignments (id, company_id, cycle_id, employee_id, questionnaire_id, token_hash, expires_at, completed_at)
       values ($1,$2,$3,$4,$5,$6, now() + interval '30 days', now())`,
      [asg, companyId, cycleId, emp, qId, `hash-ia-${corrida}-${i}`],
    );
    await consultar(
      `insert into risk_results (company_id, assignment_id, employee_id, cycle_id, questionnaire_id, cfinal, nivel_final, categorias, dominios, engine_version)
       values ($1,$2,$3,$4,$5, 130, 'alto',
         '[{"nombre":"Carga de trabajo","nivel":"alto"}]',
         '[{"nombre":"Cargas de trabajo","nivel":"alto"}]', '0.0.0-e2e')`,
      [companyId, asg, emp, cycleId, qId],
    );
  }
}

async function nuevaPagina(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext();
  return contexto.newPage();
}

async function crearCuentaYEntrar(page: Page) {
  await page.goto('/ingresar');
  await page.getByText('¿No tienes cuenta? Regístrate').click();
  await page.getByLabel('Correo electrónico').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByTestId('aviso-confirmacion')).toBeVisible();
  await consultar(`update auth.users set email_confirmed_at = now() where email = $1`, [
    ADMIN.email,
  ]);
  // Vincula la cuenta como admin_org de la empresa sembrada.
  await consultar(
    `insert into role_assignments (company_id, auth_user_id, role)
     select $1, id, 'admin_org' from auth.users where email = $2`,
    [companyId, ADMIN.email],
  );
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Mis empresas')).toBeVisible();
}

test('siembra y login', async ({ browser }) => {
  test.setTimeout(120_000);
  await sembrar();
  const page = await nuevaPagina(browser);
  await crearCuentaYEntrar(page);
  await page.context().close();
});

test('flag OFF: el dashboard ejecutivo no muestra la franja de IA', async ({ browser }) => {
  const page = await nuevaPagina(browser);
  await login(page);
  await page.goto(`/panel/${companyId}`);
  await expect(page.getByText('Estado de Ciclo IA')).toBeVisible(); // el dashboard ejecutivo carga
  await expect(page.getByTestId('ia-generar-resumen')).toHaveCount(0);
  await page.context().close();
});

test('flag ON: generar resumen (borrador inconfundible) → adoptar (leyenda) → evento en BD', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  await consultar(
    `insert into feature_flags (company_id, flag, enabled) values ($1,'ia_asistida',true)
     on conflict (company_id, flag) do update set enabled = true`,
    [companyId],
  );

  const page = await nuevaPagina(browser);
  await login(page);
  await page.goto(`/panel/${companyId}`);

  await page.getByTestId('ia-generar-resumen').click();
  const borrador = page.getByTestId('ia-borrador-resumen');
  await expect(borrador).toBeVisible();
  await expect(borrador).toContainText('sin revisar');
  // El borrador NO ofrece exportar/copiar: no hay botón de descarga en la franja.
  await expect(borrador.getByRole('button', { name: /descargar|exportar|copiar/i })).toHaveCount(0);

  await page.getByTestId('ia-adoptar-resumen').click();
  await page.getByTestId('ia-adoptar-resumen-confirmacion-confirmar').click();

  const adoptado = page.getByTestId('ia-resumen-adoptado');
  await expect(adoptado).toBeVisible();
  await expect(adoptado).toContainText('revisado y adoptado por');
  await expect(adoptado).toContainText(ADMIN.email);

  const eventos = await consultar<{ n: string }>(
    `select count(*) n from audit_log where company_id = $1 and event_type in ('ia_borrador_generado','ia_borrador_adoptado')`,
    [companyId],
  );
  expect(Number(eventos[0]!.n)).toBeGreaterThanOrEqual(2);

  // El insumo sellado quedó persistido (evidencia de qué vio la IA).
  const drafts = await consultar<{ insumo_sha256: string; adopted_at: string | null }>(
    `select insumo_sha256, adopted_at from ai_drafts where company_id = $1 and tipo = 'resumen_ejecutivo'`,
    [companyId],
  );
  expect(drafts[0]!.insumo_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(drafts[0]!.adopted_at).not.toBeNull();
  await page.context().close();
});

test('flag ON: generar plan → adoptar al programa → action_items con ai_assisted', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await nuevaPagina(browser);
  await login(page);
  await page.goto(`/panel/${companyId}/ciclos/${cycleId}/acciones`);

  await page.getByTestId('ia-generar-plan').click();
  const borrador = page.getByTestId('ia-borrador-plan');
  await expect(borrador).toBeVisible();
  await expect(borrador).toContainText('sin revisar');

  await page.getByTestId('ia-adoptar-plan').click();
  await page.getByTestId('ia-adoptar-plan-confirmacion-confirmar').click();
  await expect(page.getByText('Plan adoptado', { exact: false })).toBeVisible();

  const acciones = await consultar<{ n: string }>(
    `select count(*) n from action_items where company_id = $1 and ai_assisted = true`,
    [companyId],
  );
  expect(Number(acciones[0]!.n)).toBeGreaterThanOrEqual(1);
  await page.context().close();
});

async function login(page: Page) {
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Mis empresas')).toBeVisible();
}
