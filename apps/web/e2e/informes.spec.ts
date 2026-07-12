import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';
import pg from 'pg';
import { aceptarConsentimiento, completarYEnviar, responderFiltros } from './utilidades';

// E2E de informes y expediente (Milestone 5): un Admin de Organización genera el informe
// normativo 7.9 y el expediente de inspección de un ciclo con al menos un resultado real,
// descarga ambos y queda registrado en `audit_log`; un consultor de OTRA empresa no puede
// ver esta página (aislamiento, gate de CI).
//
// Los fixtures globales de `utilidades.ts`/`global-setup.ts` (datosE2E) solo insertan
// asignaciones crudas por SQL directo: no hay ningún usuario Admin Org dueño de esa
// empresa (autorizarEmpresa exige membresía real) ni ningún risk_results calculado (las
// asignaciones nunca se responden). Por eso este spec construye su propia empresa/ciclo
// igual que panel-admin.spec.ts: registro real vía UI (así el creador queda como admin_org)
// y un empleado que sí completa su GR-II para producir un risk_results real.

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const corrida = `${Date.now()}-${randomUUID().slice(0, 6)}`;
const ADMIN_A = { email: `informes-admin-a-${corrida}@e2e.mx`, password: 'Password123!' };
const ADMIN_B = { email: `informes-admin-b-${corrida}@e2e.mx`, password: 'Password123!' };
const CONSULTOR = { email: `informes-consultor-${corrida}@e2e.mx`, password: 'Password123!' };
const EMPRESA_A = `Informes Empresa A ${corrida}`;
const EMPRESA_B = `Informes Empresa B ${corrida}`;
const TOKEN_EMPLEADO = `e2e-informes-${corrida}`;

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

/**
 * Cliente service_role de Supabase Storage, para leer directamente del bucket privado
 * `informes` los bytes reales que la app subió (mismo patrón que `consultar()` usa contra
 * Postgres: verificación de backend con credenciales de servicio, no a través de la app).
 * Se usa para confirmar que el archivo generado es de verdad un PDF/ZIP (magic bytes),
 * evitando depender de cómo Chromium headless maneje la pestaña emergente de
 * `window.open` (ver nota de diseño en el primer test, más abajo).
 */
function clienteStorage() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

async function registrarse(page: Page, cuenta: { email: string; password: string }) {
  await page.goto('/ingresar');
  await page.getByText('¿No tienes cuenta? Regístrate').click();
  await page.getByLabel('Correo electrónico').fill(cuenta.email);
  await page.getByLabel('Contraseña').fill(cuenta.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Mis empresas')).toBeVisible();
}

async function nuevaPagina(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext();
  return contexto.newPage();
}

test('el Admin de Organización genera informe 7.9 y expediente con auditoría', async ({ page }) => {
  test.setTimeout(240_000);

  // Empresa, centro (30 trabajadores → GR-I + GR-II), un empleado y un ciclo distribuido
  await registrarse(page, ADMIN_A);
  await page.getByText('Registrar una empresa nueva').click();
  await page.getByLabel('Razón social').fill(EMPRESA_A);
  await page.getByRole('button', { name: 'Crear empresa' }).click();
  await expect(page.getByTestId('nombre-empresa')).toHaveText(EMPRESA_A);

  await page.getByLabel('Nombre', { exact: true }).fill('Centro Informes');
  await page.getByLabel('Número de trabajadores').fill('30');
  await page.getByRole('button', { name: 'Crear centro' }).click();
  await expect(page.getByTestId('lista-centros')).toContainText('GR-I + GR-II (16–50)');

  await page.goto(page.url().replace('/centros', '/empleados'));
  await page.getByLabel('Nombre completo').fill('Empleada Informes');
  await page.getByLabel('Correo electrónico').fill(`emp-informes-${corrida}@e2e.mx`);
  await page.getByLabel('Área').fill('Ventas');
  await page.getByRole('button', { name: 'Agregar empleado' }).click();
  await expect(page.getByTestId('lista-empleados')).toContainText('Empleada Informes');

  await page.goto(page.url().replace('/empleados', '/ciclos'));
  await page.getByLabel('Nombre del ciclo').fill('Ciclo Informes 2026');
  await page.getByLabel('Fecha de inicio').fill('2026-07-11');
  await page.getByLabel('Nombre del evaluador').fill('Dra. Evaluadora');
  await page.getByLabel('Cédula profesional del evaluador').fill('CED-INF');
  await page.getByRole('button', { name: 'Crear ciclo' }).click();
  await expect(page.getByText('Ciclo Informes 2026 · Centro Informes')).toBeVisible();

  await page.getByTestId('distribuir').click();
  await expect(page.getByTestId('distribuir-detalle')).toContainText('2 asignaciones creadas');

  // El empleado completa su GR-II para que el ciclo tenga un risk_results real (regla
  // inviolable 4: nadie del lado patronal ve estas respuestas; el informe solo agrega).
  const [empresa] = await consultar<{ id: string }>(
    `select id from companies where legal_name = $1`,
    [EMPRESA_A],
  );
  const empresaId = empresa?.id ?? '';
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
    [hash, empresaId, `emp-informes-${corrida}@e2e.mx`],
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
  const cicloId = ciclo?.id ?? '';

  await page.goto(`/panel/${empresaId}/ciclos/${cicloId}/informes`);

  // (a) Generar informe 7.9 → aparece en la tabla con un sha256 visible (truncado)
  await page.getByTestId('generar-informe-79').click();
  const filaInforme79 = page.locator('[data-testid="fila-informe"][data-report-type="informe_79"]');
  await expect(filaInforme79).toHaveCount(1);
  const shaTruncado = await filaInforme79.locator('td').nth(2).innerText();
  expect(shaTruncado.replace('…', '')).toMatch(/^[0-9a-f]{12}$/);

  // (b) Descargar → la respuesta es un PDF real.
  //
  // Nota de diseño (descarga): el botón abre la URL firmada con `window.open(url, '_blank')`
  // (con un <a> de respaldo si el navegador bloquea la ventana). Interceptar esa pestaña
  // emergente en Chromium headless para inspeccionar su respuesta de red es frágil sin poder
  // correr esto localmente aquí (Docker no disponible en este sandbox): un content-type
  // application/pdf puede disparar el visor de PDF integrado, una descarga nativa, o nada
  // navegable en absoluto según la configuración del navegador headless, y no hay forma de
  // confirmar el comportamiento real sin CI. Por eso SÍ se hace clic real en "Descargar"
  // (dispara accionUrlDescargaInforme de verdad, que es lo que genera el evento auditado
  // `informe_descargado` verificado en (d)), pero para el propio contenido del archivo se
  // usa el patrón ya establecido en panel-admin.spec.ts de verificación directa de backend
  // con credenciales de servicio: se lee compliance_reports.storage_path por SQL y se baja
  // el objeto del bucket privado `informes` con el cliente service_role de Storage, y se
  // comprueban los magic bytes. Esto es una verificación más robusta y determinista en CI
  // headless que perseguir la pestaña emergente, al costo de no ejercitar el manejo del
  // navegador de la propia ventana emergente end-to-end (ver limitaciones en el reporte).
  // Timeout explícito de 15s para fallar rápido si window.open retorna null (fallback link).
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 15_000 }),
    filaInforme79.getByTestId('descargar-informe').click(),
  ]);
  await popup.close();

  const [reporteInforme79] = await consultar<{ id: string; storage_path: string; sha256: string }>(
    `select id, storage_path, sha256 from compliance_reports
     where company_id = $1 and cycle_id = $2 and report_type = 'informe_79'
     order by created_at desc limit 1`,
    [empresaId, cicloId],
  );
  expect(reporteInforme79).toBeTruthy();
  const storage = clienteStorage();
  const { data: pdfBlob, error: errorPdf } = await storage.storage
    .from('informes')
    .download(reporteInforme79.storage_path);
  expect(errorPdf).toBeNull();
  const pdfBytes = Buffer.from(await pdfBlob!.arrayBuffer());
  expect(pdfBytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
  expect(createHash('sha256').update(pdfBytes).digest('hex')).toBe(reporteInforme79.sha256);

  // (c) Generar expediente → aparece en la tabla con su propio data-report-type
  await page.getByTestId('generar-expediente').click();
  const filaExpediente = page.locator(
    '[data-testid="fila-informe"][data-report-type="expediente_zip"]',
  );
  await expect(filaExpediente).toHaveCount(1);

  const [reporteExpediente] = await consultar<{ storage_path: string; sha256: string }>(
    `select storage_path, sha256 from compliance_reports
     where company_id = $1 and cycle_id = $2 and report_type = 'expediente_zip'
     order by created_at desc limit 1`,
    [empresaId, cicloId],
  );
  expect(reporteExpediente).toBeTruthy();
  const { data: zipBlob, error: errorZip } = await storage.storage
    .from('informes')
    .download(reporteExpediente.storage_path);
  expect(errorZip).toBeNull();
  const zipBytes = Buffer.from(await zipBlob!.arrayBuffer());
  expect(zipBytes.subarray(0, 2).toString('latin1')).toBe('PK'); // magic bytes de ZIP
  expect(createHash('sha256').update(zipBytes).digest('hex')).toBe(reporteExpediente.sha256);

  // (d) audit_log tiene los eventos auditados de generación y descarga
  const eventos = await consultar<{ event_type: string; n: number }>(
    `select event_type, count(*)::int as n from audit_log
     where company_id = $1
       and event_type in ('informe_generado', 'informe_descargado', 'expediente_generado')
     group by event_type`,
    [empresaId],
  );
  const conteos = new Map(eventos.map((e) => [e.event_type, e.n]));
  expect(conteos.get('informe_generado')).toBeGreaterThanOrEqual(1);
  expect(conteos.get('informe_descargado')).toBeGreaterThanOrEqual(1);
  expect(conteos.get('expediente_generado')).toBeGreaterThanOrEqual(1);
});

test('un consultor de otra empresa no ve los informes de esta empresa', async ({ browser }) => {
  test.setTimeout(120_000);

  // El consultor y la empresa B existen, pero el consultor NUNCA se asigna a la empresa A
  const paginaConsultor = await nuevaPagina(browser);
  await registrarse(paginaConsultor, CONSULTOR);

  const paginaAdminB = await nuevaPagina(browser);
  await registrarse(paginaAdminB, ADMIN_B);
  await paginaAdminB.getByText('Registrar una empresa nueva').click();
  await paginaAdminB.getByLabel('Razón social').fill(EMPRESA_B);
  await paginaAdminB.getByRole('button', { name: 'Crear empresa' }).click();
  await expect(paginaAdminB.getByTestId('nombre-empresa')).toHaveText(EMPRESA_B);

  // El consultor SÍ opera la empresa B (control), para distinguir "no tiene sesión" de
  // "no tiene membresía en A": se le asigna a B, no a A.
  const [empresaB] = await consultar<{ id: string }>(
    `select id from companies where legal_name = $1`,
    [EMPRESA_B],
  );
  await paginaAdminB.goto(`/panel/${empresaB?.id}/equipo`);
  await paginaAdminB.getByTestId('email-consultor').fill(CONSULTOR.email);
  await paginaAdminB.getByTestId('agregar-consultor').click();
  await expect(paginaAdminB.getByText('Consultores: 1')).toBeVisible();

  const [empresaA] = await consultar<{ id: string }>(
    `select id from companies where legal_name = $1`,
    [EMPRESA_A],
  );
  const [ciclo] = await consultar<{ id: string }>(
    `select id from compliance_cycles where company_id = $1`,
    [empresaA?.id],
  );

  // Acceso directo por URL a los informes de la empresa A: rebotado al panel (aislamiento,
  // regla inviolable 6 — la membresía real se re-verifica en autorizarEmpresa, nunca se
  // confía en el companyId de la URL).
  await paginaConsultor.goto(`/panel/${empresaA?.id}/ciclos/${ciclo?.id}/informes`);
  await expect(paginaConsultor.getByText('Mis empresas')).toBeVisible();
  await expect(paginaConsultor).toHaveURL(/\/panel$/);
});
