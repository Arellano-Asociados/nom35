import { createHash, randomUUID } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
import pg from 'pg';
import { aceptarConsentimiento, completarYEnviar, responderFiltros } from './utilidades';

// E2E del panel administrativo (criterios Done del Milestone 4):
//  * Un Admin de Organización ejecuta el ciclo completo sin intervención técnica.
//  * Un Consultor opera las empresas asignadas y ninguna más.
//  * La auditoría registra los accesos individuales.

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const corrida = `${Date.now()}-${randomUUID().slice(0, 6)}`;
const ADMIN_A = { email: `admin-a-${corrida}@e2e.mx`, password: 'Password123!Segura' };
const ADMIN_B = { email: `admin-b-${corrida}@e2e.mx`, password: 'Password123!Segura' };
const CONSULTOR = { email: `consultor-${corrida}@e2e.mx`, password: 'Password123!Segura' };
const EMPRESA_A = `Empresa A ${corrida}`;
const EMPRESA_B = `Empresa B ${corrida}`;
const TOKEN_EMPLEADO = `e2e-panel-${corrida}`;

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
 * Alta de cuenta. Con la confirmación de correo obligatoria (endurecimiento de la
 * auditoría v0: impide que un tercero reclame el correo de un consultor ajeno), el
 * registro NO deja sesión: la cuenta queda inactiva hasta que la persona abre el
 * enlace que recibe. Aquí simulamos ese clic confirmando el correo en la BD, que es
 * exactamente el efecto del enlace, y después ingresamos con la contraseña.
 */
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
  await ingresar(page, cuenta);
}

async function ingresar(page: Page, cuenta: { email: string; password: string }) {
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill(cuenta.email);
  await page.getByLabel('Contraseña').fill(cuenta.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Mis empresas')).toBeVisible();
}

async function nuevaPagina(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext();
  return contexto.newPage();
}

test('el Admin de Organización ejecuta el ciclo completo', async ({ page }) => {
  test.setTimeout(240_000);

  // Registro y alta de empresa
  await registrarse(page, ADMIN_A);
  await page.getByText('Registrar una empresa nueva').click();
  await page.getByLabel('Razón social').fill(EMPRESA_A);
  await page.getByRole('button', { name: 'Crear empresa' }).click();
  await expect(page.getByTestId('nombre-empresa')).toHaveText(EMPRESA_A);

  // Centro de trabajo (30 trabajadores → GR-I + GR-II)
  await page.getByLabel('Nombre', { exact: true }).fill('Centro Principal');
  await page.getByLabel('Número de trabajadores').fill('30');
  await page.getByRole('button', { name: 'Crear centro' }).click();
  await expect(page.getByTestId('lista-centros')).toContainText('GR-I + GR-II (16–50)');

  // Alta individual de empleado
  await page.goto(page.url().replace('/centros', '/empleados'));
  await page.getByLabel('Nombre completo').fill('Empleada Uno');
  await page.getByLabel('Correo electrónico').fill(`emp1-${corrida}@e2e.mx`);
  await page.getByLabel('Área').fill('Ventas');
  await page.getByRole('button', { name: 'Agregar empleado' }).click();
  await expect(page.getByTestId('lista-empleados')).toContainText('Empleada Uno');

  // Importación CSV con reporte de errores (2 válidos + 1 inválido)
  const csv = [
    'nombre,email,area,atiende_clientes,supervisa_personal',
    `Empleado Dos,emp2-${corrida}@e2e.mx,Producción,no,no`,
    `Empleado Tres,emp3-${corrida}@e2e.mx,Producción,si,no`,
    'Sin Email,no-es-un-email,Ventas,si,no',
  ].join('\n');
  await page.getByTestId('csv-contenido').fill(csv);
  await page.getByTestId('importar-csv').click();
  await expect(page.getByTestId('csv-reporte')).toContainText('2 empleados importados');
  await expect(page.getByTestId('csv-reporte')).toContainText('Email inválido');

  // Ciclo con selección automática de guías por categoría
  await page.goto(page.url().replace('/empleados', '/ciclos'));
  await page.getByLabel('Nombre del ciclo').fill('Ciclo 2026');
  await page.getByLabel('Fecha de inicio').fill('2026-07-11');
  await page.getByLabel('Nombre del evaluador').fill('Dra. Evaluadora');
  await page.getByLabel('Cédula profesional del evaluador').fill('CED-123');
  await page.getByRole('button', { name: 'Crear ciclo' }).click();
  await expect(page.getByText('Ciclo 2026 · Centro Principal')).toBeVisible();

  // Distribución: 3 empleados × 2 guías (GR-I y GR-II) = 6 asignaciones.
  // Distribuir es irreversible (correos reales), así que pide confirmación en un
  // <dialog> propio que anuncia cuántos correos saldrán antes de permitir el envío.
  await page.getByTestId('distribuir').click();
  await expect(page.getByTestId('distribuir-confirmacion')).toContainText('Se enviarán 6 correos');
  await page.getByTestId('distribuir-confirmacion-confirmar').click();
  await expect(page.getByTestId('distribuir-detalle')).toContainText('6 asignaciones creadas');
  await expect(page.getByTestId('progreso-areas')).toContainText('Ventas');
  await expect(page.getByTestId('progreso-areas')).toContainText('Producción');

  // Recordatorios a pendientes (rotan token y reenvían): la confirmación advierte
  // que los enlaces anteriores dejarán de funcionar.
  await page.getByTestId('recordatorios').click();
  await expect(page.getByTestId('recordatorios-confirmacion')).toContainText(
    'Los enlaces anteriores dejarán de funcionar',
  );
  await page.getByTestId('recordatorios-confirmacion-confirmar').click();
  await expect(page.getByTestId('recordatorios-detalle')).toContainText('recordatorios enviados');

  // Un empleado completa su GR-II (token conocido inyectado sobre su asignación)
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
    [hash, empresaId, `emp1-${corrida}@e2e.mx`],
  );

  await page.goto(`/responder/${TOKEN_EMPLEADO}`);
  await aceptarConsentimiento(page);
  await responderFiltros(page, 'No', 'No');
  await completarYEnviar(page, 'Nunca');
  await expect(page.getByTestId('nivel-final')).toHaveText('Medio');

  // Progreso refleja el completado y el dashboard aplica la supresión n<3
  await page.goto(`/panel/${empresaId}/ciclos`);
  await page.getByTestId('lista-ciclos').getByText('Ciclo 2026').click();
  await expect(page.getByTestId('progreso-areas')).toBeVisible();
  await page.getByText('Dashboard agregado').click();
  await expect(page.getByTestId('dist-cfinal')).toContainText('<3');

  // Designación como Responsable Designado
  await page.goto(`/panel/${empresaId}/equipo`);
  await page.getByLabel('Cédula profesional (evidencia del responsable)').fill('CED-123');
  await page.getByTestId('designarme-rd').click();
  await expect(page.getByTestId('soy-rd')).toBeVisible();

  // Acceso individual auditado: interstitial + evento en audit_log
  const [ciclo] = await consultar<{ id: string }>(
    `select id from compliance_cycles where company_id = $1`,
    [empresaId],
  );
  await page.goto(`/panel/${empresaId}/ciclos/${ciclo?.id}/individual`);
  await page.getByTestId('lista-individual').getByText('Empleada Uno').click();
  await expect(page.getByTestId('interstitial')).toBeVisible();
  await page.getByTestId('confirmar-acceso').click();
  await expect(page.getByTestId('nivel-individual')).toHaveText('Medio');

  const accesos = await consultar<{ n: number }>(
    `select count(*)::int as n from audit_log
     where company_id = $1 and event_type = 'individual_result_access'`,
    [empresaId],
  );
  expect(accesos[0]?.n).toBeGreaterThanOrEqual(1);

  // Política de prevención: publicar y acuse del empleado
  await page.goto(`/panel/${empresaId}/politica`);
  await page.getByLabel('Título').fill('Política de prevención');
  await page.getByLabel('Versión').fill('1.0');
  await page.getByLabel('Archivo (PDF)').setInputFiles({
    name: 'politica.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 politica de prueba'),
  });
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByTestId('lista-politicas')).toContainText('Política de prevención');

  await page.goto(`/responder/${TOKEN_EMPLEADO}`);
  await expect(page.getByTestId('politica-pendiente')).toBeVisible();
  await page.getByTestId('acusar-politica').click();
  await expect(page.getByTestId('politica-pendiente')).toHaveCount(0);

  await page.goto(`/panel/${empresaId}/politica`);
  await expect(page.getByText('1 de 3 empleados')).toBeVisible();
});

test('un consultor opera solo las empresas asignadas', async ({ browser }) => {
  test.setTimeout(120_000);

  // El consultor y la empresa B existen
  const paginaConsultor = await nuevaPagina(browser);
  await registrarse(paginaConsultor, CONSULTOR);

  const paginaAdminB = await nuevaPagina(browser);
  await registrarse(paginaAdminB, ADMIN_B);
  await paginaAdminB.getByText('Registrar una empresa nueva').click();
  await paginaAdminB.getByLabel('Razón social').fill(EMPRESA_B);
  await paginaAdminB.getByRole('button', { name: 'Crear empresa' }).click();
  await expect(paginaAdminB.getByTestId('nombre-empresa')).toHaveText(EMPRESA_B);

  // El admin de A asigna al consultor
  const paginaAdminA = await nuevaPagina(browser);
  await ingresar(paginaAdminA, ADMIN_A);
  const [empresaA] = await consultar<{ id: string }>(
    `select id from companies where legal_name = $1`,
    [EMPRESA_A],
  );
  await paginaAdminA.goto(`/panel/${empresaA?.id}/equipo`);
  await paginaAdminA.getByTestId('email-consultor').fill(CONSULTOR.email);
  await paginaAdminA.getByTestId('agregar-consultor').click();
  await expect(paginaAdminA.getByText('Consultores: 1')).toBeVisible();

  // El consultor ve la empresa A (y solo esa) y puede operarla
  await paginaConsultor.goto('/panel');
  await expect(paginaConsultor.getByTestId('lista-empresas')).toContainText(EMPRESA_A);
  await expect(paginaConsultor.getByTestId('lista-empresas')).not.toContainText(EMPRESA_B);
  await paginaConsultor.getByText(EMPRESA_A).click();
  await expect(paginaConsultor.getByTestId('lista-centros')).toContainText('Centro Principal');

  // Acceso directo por URL a la empresa B: rebotado al panel
  const [empresaB] = await consultar<{ id: string }>(
    `select id from companies where legal_name = $1`,
    [EMPRESA_B],
  );
  await paginaConsultor.goto(`/panel/${empresaB?.id}/centros`);
  await expect(paginaConsultor.getByText('Mis empresas')).toBeVisible();
  await expect(paginaConsultor).toHaveURL(/\/panel$/);
});
