import { createHash, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { aceptarConsentimiento, completarYEnviar, responderFiltros } from './utilidades';

// E2E del ciclo normativo completo (Fase 4): difusión de resultados con acuse del
// trabajador (5.7 e / 7.8), buzón de quejas anónimo con folio y seguimiento (8.1 b)
// y Programa de intervención pre-poblado (8.3/8.4). Construye su propia empresa como
// informes.spec.ts (registro real vía UI para que el creador sea admin_org) y un
// empleado que completa su GR-II respondiendo "Nunca": el grupo A (ítems 18–33)
// puntúa 64 → Cfinal en nivel medio, que EXIGE programa (Tabla 4).

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const corrida = `${Date.now()}-${randomUUID().slice(0, 6)}`;
const ADMIN = { email: `ciclo-admin-${corrida}@e2e.mx`, password: 'Password123!Segura' };
const EMPRESA = `Ciclo Normativo ${corrida}`;
const TOKEN_EMPLEADO = `e2e-ciclo-normativo-${corrida}`;

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

async function registrarse(page: Page, cuenta: { email: string; password: string }) {
  await page.goto('/ingresar');
  await page.getByText('¿No tienes cuenta? Regístrate').click();
  await page.getByLabel('Correo electrónico').fill(cuenta.email);
  await page.getByLabel('Contraseña').fill(cuenta.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByTestId('aviso-confirmacion')).toBeVisible();
  await consultar(`update auth.users set email_confirmed_at = now() where email = $1`, [
    cuenta.email,
  ]);
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill(cuenta.email);
  await page.getByLabel('Contraseña').fill(cuenta.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Mis empresas')).toBeVisible();
}

let empresaId = '';
let cicloId = '';

test('preparación: empresa con un resultado real en nivel medio', async ({ page }) => {
  test.setTimeout(240_000);

  await registrarse(page, ADMIN);
  await page.getByText('Registrar una empresa nueva').click();
  await page.getByLabel('Razón social').fill(EMPRESA);
  await page.getByRole('button', { name: 'Registrar empresa' }).click();
  await expect(page.getByTestId('nombre-empresa')).toHaveText(EMPRESA);

  await page.getByLabel('Nombre', { exact: true }).fill('Centro Ciclo');
  await page.getByLabel('Número de trabajadores').fill('30');
  await page.getByRole('button', { name: 'Crear centro' }).click();
  await expect(page.getByTestId('lista-centros')).toContainText('GR-I + GR-II (16–50)');

  await page.goto(page.url().replace('/centros', '/empleados'));
  await page.getByLabel('Nombre completo').fill('Empleada Ciclo');
  await page.getByLabel('Correo electrónico').fill(`emp-ciclo-${corrida}@e2e.mx`);
  await page.getByLabel('Área', { exact: true }).fill('Operaciones');
  await page.getByRole('button', { name: 'Agregar empleado' }).click();
  await expect(page.getByTestId('lista-empleados')).toContainText('Empleada Ciclo');

  await page.goto(page.url().replace('/empleados', '/ciclos'));
  await page.getByLabel('Nombre del ciclo').fill('Ciclo Normativo 2026');
  await page.getByLabel('Fecha de inicio').fill('2026-07-13');
  await page.getByLabel('Nombre del evaluador').fill('Dra. Normativa');
  await page.getByLabel('Cédula profesional del evaluador').fill('CED-CN');
  await page.getByRole('button', { name: 'Crear ciclo' }).click();
  await expect(page.getByText('Ciclo Normativo 2026 · Centro Ciclo')).toBeVisible();

  await page.getByTestId('distribuir').click();
  await page.getByTestId('distribuir-confirmacion-confirmar').click();
  await expect(page.getByTestId('distribuir-detalle')).toContainText('2 asignaciones creadas');

  const [empresa] = await consultar<{ id: string }>(
    `select id from companies where legal_name = $1`,
    [EMPRESA],
  );
  empresaId = empresa?.id ?? '';
  const hash = createHash('sha256').update(TOKEN_EMPLEADO).digest('hex');
  await consultar(
    `update questionnaire_assignments qa set token_hash = $1
     where qa.id = (
       select qa2.id from questionnaire_assignments qa2
       join questionnaires q on q.id = qa2.questionnaire_id
       join employees e on e.id = qa2.employee_id
       where qa2.company_id = $2 and q.code = 'GR-II' and e.email = $3
       limit 1
     )`,
    [hash, empresaId, `emp-ciclo-${corrida}@e2e.mx`],
  );

  await page.goto(`/responder/${TOKEN_EMPLEADO}`);
  await aceptarConsentimiento(page);
  await responderFiltros(page, 'No', 'No');
  await completarYEnviar(page, 'Nunca');
  await expect(page.getByTestId('nivel-final')).toBeVisible();

  const [ciclo] = await consultar<{ id: string }>(
    `select id from compliance_cycles where company_id = $1`,
    [empresaId],
  );
  cicloId = ciclo?.id ?? '';
  expect(cicloId).not.toBe('');
});

test('difusión: publicar constancia sellada, consultarla y acusarla con el token del trabajador', async ({
  page,
}) => {
  test.setTimeout(180_000);

  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Mis empresas')).toBeVisible();

  await page.goto(`/panel/${empresaId}/ciclos/${cicloId}/difusion`);
  await expect(page.getByTestId('resumen-difusion')).toBeVisible(); // vista previa

  await page.getByTestId('publicar-difusion').click();
  await page.getByTestId('publicar-difusion-confirmacion-confirmar').click();
  const historial = page.getByTestId('historial-difusion');
  await expect(historial).toBeVisible({ timeout: 15_000 });
  await expect(historial).toContainText('v1');
  // sha256 visible completo en el historial (huella de integridad)
  await expect(historial.locator('td.font-mono').first()).toContainText(/[0-9a-f]{64}/);

  const [registro] = await consultar<{ sha256: string }>(
    `select sha256 from dissemination_records where company_id = $1 and cycle_id = $2`,
    [empresaId, cicloId],
  );
  expect(registro?.sha256).toMatch(/^[0-9a-f]{64}$/);

  // El trabajador (cuestionario ya enviado) ve la constancia y acusa "Enterado".
  await page.goto(`/responder/${TOKEN_EMPLEADO}`);
  await expect(page.getByTestId('confirmacion')).toBeVisible();
  await expect(page.getByTestId('resumen-difusion')).toBeVisible();
  await page.getByTestId('acusar-difusion').click();
  await expect(page.getByTestId('difusion-acusada')).toBeVisible({ timeout: 15_000 });

  const [{ n }] = await consultar<{ n: number }>(
    `select count(*)::int as n from dissemination_receipts where company_id = $1`,
    [empresaId],
  );
  expect(n).toBe(1);
});

test('buzón: queja anónima con folio, lectura auditada en el panel y seguimiento visible al trabajador', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);

  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Mis empresas')).toBeVisible();

  // Crear el enlace del buzón desde el panel
  await page.goto(`/panel/${empresaId}/buzon`);
  await page.getByTestId('crear-enlace-buzon').click();
  await expect(page.getByTestId('url-buzon')).toBeVisible({ timeout: 15_000 });

  const [buzon] = await consultar<{ token: string }>(
    `select token from complaint_boxes where company_id = $1`,
    [empresaId],
  );
  const tokenBuzon = buzon?.token ?? '';
  expect(tokenBuzon).not.toBe('');

  // El trabajador presenta una queja ANÓNIMA sin sesión (contexto aparte)
  const contexto = await browser.newContext();
  const paginaTrabajador = await contexto.newPage();
  await paginaTrabajador.goto(`/buzon/${tokenBuzon}`);
  // Selección por <label> (el encabezado de la página también menciona
  // "violencia laboral" y rompería el modo estricto con getByText).
  await paginaTrabajador.locator('label').filter({ hasText: 'Actos de violencia laboral' }).click();
  await paginaTrabajador
    .getByTestId('texto-queja')
    .fill('Mi supervisor me grita frente a mis compañeros desde hace dos semanas.');
  await paginaTrabajador.locator('label').filter({ hasText: 'De forma anónima.' }).click();
  await paginaTrabajador.getByTestId('enviar-queja').click();
  await expect(paginaTrabajador.getByTestId('recibo-queja')).toBeVisible({ timeout: 15_000 });
  const folio = (await paginaTrabajador.getByTestId('folio-queja').innerText()).trim();
  const clave = (await paginaTrabajador.getByTestId('clave-queja').innerText()).trim();
  expect(folio).toMatch(/^QJ-/);
  expect(clave).toHaveLength(12);

  // Consulta del folio: estado "Recibida", sin contenido
  await paginaTrabajador.getByTestId('tab-consultar').click();
  await paginaTrabajador.getByTestId('consulta-folio').fill(folio);
  await paginaTrabajador.getByTestId('consulta-clave').fill(clave);
  await paginaTrabajador.getByTestId('consultar-folio').click();
  await expect(paginaTrabajador.getByTestId('estado-queja')).toContainText('Recibida');

  // El admin abre la queja: el contenido se ve y la lectura queda AUDITADA
  await page.goto(`/panel/${empresaId}/buzon`);
  await expect(page.getByTestId('lista-quejas')).toContainText(folio);
  await page.getByRole('link', { name: folio }).click();
  await expect(page.getByTestId('cuerpo-queja')).toContainText('me grita');

  const [{ n: consultas }] = await consultar<{ n: number }>(
    `select count(*)::int as n from audit_log
     where company_id = $1 and event_type = 'queja_consultada'`,
    [empresaId],
  );
  expect(consultas).toBeGreaterThanOrEqual(1);

  // Seguimiento con nota (8.2 g) → el trabajador ve el nuevo estado con su folio
  await page.getByTestId('queja-nuevo-estado').selectOption('en_revision');
  await page.getByTestId('queja-nota').fill('Se abrió investigación con RH.');
  await page.getByTestId('queja-guardar-estado').click();
  await expect(page.getByTestId('bitacora-queja')).toContainText('Se abrió investigación', {
    timeout: 15_000,
  });

  await paginaTrabajador.getByTestId('consultar-folio').click();
  await expect(paginaTrabajador.getByTestId('estado-queja')).toContainText('En revisión');
  await contexto.close();
});

test('programa de intervención: exigido por nivel medio, pre-poblado y con avance', async ({
  page,
}) => {
  test.setTimeout(180_000);

  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Mis empresas')).toBeVisible();

  await page.goto(`/panel/${empresaId}/ciclos/${cicloId}/acciones`);
  // Todo "Nunca" en GR-II → grupo A (18–33) = 64 puntos → Cfinal medio: exige programa
  await expect(page.getByTestId('banner-exige-programa')).toBeVisible();
  await expect(page.getByTestId('crear-programa')).toBeVisible();

  await page.getByTestId('programa-areas').fill('Todo el Centro Ciclo');
  await page.getByTestId('programa-responsable').fill('Recursos Humanos');
  await page.getByTestId('programa-crear').click();
  await expect(page.getByTestId('programa-detalle')).toBeVisible({ timeout: 15_000 });

  // Las acciones pre-pobladas de la Tabla 4/7 quedaron registradas
  const lista = page.getByTestId('lista-acciones');
  await expect(lista).toContainText('Revisar la política de prevención');

  // Control de avances (8.4 d): completar la primera acción actualiza el contador
  await page.locator('[data-testid^="estatus-"]').first().selectOption('completada');
  await expect(page.getByTestId('programa-detalle')).toContainText('1 de', { timeout: 15_000 });

  const [{ n }] = await consultar<{ n: number }>(
    `select count(*)::int as n from action_items
     where company_id = $1 and cycle_id = $2 and program_id is not null`,
    [empresaId, cicloId],
  );
  expect(n).toBeGreaterThanOrEqual(2);
});
