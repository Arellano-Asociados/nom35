import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
import pg from 'pg';

// E2E del portal super-admin de plataforma (Fase 5):
//  * Login de operador con MFA FORZADO (sin factor no hay camino a /admin).
//  * Suspensión: visible en el panel del tenant y escritura bloqueada (RESTRICTIVE en BD).
//  * Solicitud → grant por deep link (consentimiento del cliente) → vista de soporte con
//    evento soporte_vista_consultada verificado en la bitácora del tenant.
//  * Decisión 5a: el grant del operador A NO abre nada al operador B.

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const corrida = `${Date.now()}-${randomUUID().slice(0, 6)}`;
const OPERADOR_A = { email: `op-a-${corrida}@e2e.mx`, password: 'Password123!Segura' };
const OPERADOR_B = { email: `op-b-${corrida}@e2e.mx`, password: 'Password123!Segura' };
const ADMIN_TENANT = { email: `cliente-${corrida}@e2e.mx`, password: 'Password123!Segura' };
const EMPRESA = `Cliente Soporte ${corrida}`;

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

/** TOTP RFC 6238 (SHA-1, 30 s, 6 dígitos) desde el secreto base32 que muestra la UI. */
function codigoTotp(secretoBase32: string, ahoraMs = Date.now()): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secretoBase32.replace(/=+$/, '').toUpperCase()) {
    const v = alfabeto.indexOf(c);
    if (v === -1) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigInt64BE(BigInt(Math.floor(ahoraMs / 30_000)));
  const hmac = createHmac('sha1', bytes).update(contador).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

/** Alta de cuenta auth por la puerta del panel (patrón de panel-admin.spec.ts). */
async function crearCuenta(page: Page, cuenta: { email: string; password: string }) {
  await page.goto('/ingresar');
  await page.getByText('¿No tienes cuenta? Regístrate').click();
  await page.getByLabel('Correo electrónico').fill(cuenta.email);
  await page.getByLabel('Contraseña').fill(cuenta.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByTestId('aviso-confirmacion')).toBeVisible();
  await consultar(`update auth.users set email_confirmed_at = now() where email = $1`, [
    cuenta.email,
  ]);
}

/**
 * Convierte la cuenta en operador de plataforma (fila real en platform_users, como lo
 * haría crear-operador.mjs) y completa el PRIMER acceso: login → enrolamiento TOTP
 * FORZADO → portal. Devuelve el secreto TOTP para logins posteriores.
 */
async function altaOperador(page: Page, cuenta: { email: string; password: string }) {
  await crearCuenta(page, cuenta);
  await consultar(
    `insert into platform_users (auth_user_id, email, status, activated_at)
     select id, $1::text, 'active', now() from auth.users where email = $1::text`,
    [cuenta.email],
  );

  await page.goto('/admin/ingresar');
  await page.getByLabel('Correo electrónico').fill(cuenta.email);
  await page.getByLabel('Contraseña').fill(cuenta.password);
  await page.getByTestId('admin-ingresar').click();

  // MFA forzado: sin factor TOTP no hay camino a /admin (spec §1.4).
  await expect(page).toHaveURL(/\/admin\/mfa\/enrolar/);
  await page.getByTestId('admin-mfa-activar').click();
  const secreto = (await page.locator('code').first().innerText()).trim();
  await page.getByLabel('Código de 6 dígitos').fill(codigoTotp(secreto));
  await page.getByTestId('admin-mfa-confirmar').click();
  await expect(page.getByText('Operación de plataforma').first()).toBeVisible();
  return secreto;
}

async function nuevaPagina(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext();
  return contexto.newPage();
}

/** Login de un operador YA enrolado: contraseña + código TOTP (secreto desde la BD). */
async function ingresarOperador(page: Page, cuenta: { email: string; password: string }) {
  await page.goto('/admin/ingresar');
  await page.getByLabel('Correo electrónico').fill(cuenta.email);
  await page.getByLabel('Contraseña').fill(cuenta.password);
  await page.getByTestId('admin-ingresar').click();
  const factores = await consultar<{ secret: string }>(
    `select f.secret from auth.mfa_factors f
     join auth.users u on u.id = f.user_id
     where u.email = $1 and f.status = 'verified'`,
    [cuenta.email],
  );
  await page.getByLabel('Código de tu app autenticadora').fill(codigoTotp(factores[0]!.secret));
  await page.getByTestId('admin-verificar-mfa').click();
  await expect(page.getByText('Operación de plataforma').first()).toBeVisible();
}

let companyId = '';
let operadorAId = '';

test('el operador entra con MFA forzado y ve el portal', async ({ browser }) => {
  test.setTimeout(180_000);
  const page = await nuevaPagina(browser);
  await altaOperador(page, OPERADOR_A);

  // El dashboard operativo carga (métricas de §5) y la navegación existe.
  await page.goto('/admin');
  await expect(page.getByText('Tasa de respuesta global')).toBeVisible();

  const filas = await consultar<{ id: string }>(`select id from platform_users where email = $1`, [
    OPERADOR_A.email,
  ]);
  operadorAId = filas[0]!.id;
  await page.context().close();
});

test('suspensión: visible en el panel del tenant y escritura bloqueada en BD', async ({
  browser,
}) => {
  test.setTimeout(240_000);

  // Tenant real por la puerta de autoservicio (decisión 1: se conserva).
  const cliente = await nuevaPagina(browser);
  await crearCuenta(cliente, ADMIN_TENANT);
  await cliente.goto('/ingresar');
  await cliente.getByLabel('Correo electrónico').fill(ADMIN_TENANT.email);
  await cliente.getByLabel('Contraseña').fill(ADMIN_TENANT.password);
  await cliente.getByRole('button', { name: 'Ingresar' }).click();
  await expect(cliente.getByText('Mis empresas')).toBeVisible();
  await cliente.getByText('Registrar una empresa nueva').click();
  await cliente.getByLabel('Razón social').fill(EMPRESA);
  await cliente.getByRole('button', { name: 'Registrar empresa' }).click();
  await expect(cliente.getByTestId('nombre-empresa')).toHaveText(EMPRESA);
  const filas = await consultar<{ id: string }>(`select id from companies where legal_name = $1`, [
    EMPRESA,
  ]);
  companyId = filas[0]!.id;

  // El operador A suspende desde la ficha (motivo + confirmación explícita).
  const operador = await nuevaPagina(browser);
  await ingresarOperador(operador, OPERADOR_A);
  await operador.goto(`/admin/organizaciones/${companyId}`);
  await operador.getByTestId('suspender-empresa-motivo').fill('Impago (E2E)');
  await operador.getByTestId('suspender-empresa').click();
  await operador.getByTestId('suspender-empresa-confirmacion-confirmar').click();
  await expect(operador.getByText('Suspendida')).toBeVisible();

  // El panel del tenant muestra el aviso con las tres claves del copy (§2.4)…
  await cliente.reload();
  await expect(cliente.getByTestId('aviso-suspension')).toBeVisible();
  await expect(cliente.getByTestId('aviso-suspension')).toContainText(
    'obligaciones NOM-035 siguen vigentes',
  );

  // …y la ESCRITURA muere en BD (política RESTRICTIVE): crear un centro falla.
  await cliente.goto(cliente.url().replace(/\/panel\/([^/]+).*/, '/panel/$1/centros'));
  await cliente.getByLabel('Nombre', { exact: true }).fill('Centro bloqueado');
  await cliente.getByLabel('Número de trabajadores').fill('20');
  await cliente.getByRole('button', { name: 'Crear centro' }).click();
  await expect(cliente.getByRole('alert')).toBeVisible();
  const centros = await consultar<{ n: string }>(
    `select count(*) n from work_centers where company_id = $1`,
    [companyId],
  );
  expect(Number(centros[0]!.n)).toBe(0);

  // Reactivación por la UI (active de nuevo: el grant de soporte exige tenant activo).
  await operador.goto(`/admin/organizaciones/${companyId}`);
  await operador.getByTestId('reactivar-empresa').click();
  await operador.getByTestId('reactivar-empresa-confirmacion-confirmar').click();
  await expect(operador.getByText('Activa', { exact: true })).toBeVisible();
  await operador.context().close();
  await cliente.context().close();
});

test('grant por deep link, vista de soporte con evento en BD, y el grant de A no abre para B', async ({
  browser,
}) => {
  test.setTimeout(300_000);

  // El admin del cliente abre el deep link (como llegaría en el correo de solicitud),
  // ve el formulario PRE-LLENADO con el operador exacto y confirma CON SU SESIÓN.
  const cliente = await nuevaPagina(browser);
  await cliente.goto('/ingresar');
  await cliente.getByLabel('Correo electrónico').fill(ADMIN_TENANT.email);
  await cliente.getByLabel('Contraseña').fill(ADMIN_TENANT.password);
  await cliente.getByRole('button', { name: 'Ingresar' }).click();
  await expect(cliente.getByText('Mis empresas')).toBeVisible();

  await cliente.goto(
    `/panel/${companyId}/soporte?operador=${operadorAId}&horas=24&motivo=Depurar%20informe`,
  );
  await expect(cliente.getByTestId('soporte-operador-email')).toHaveText(OPERADOR_A.email);
  await cliente.getByTestId('soporte-otorgar').click();
  await cliente.getByTestId('soporte-otorgar-confirmacion-confirmar').click();
  await expect(cliente.getByText('Vigente').first()).toBeVisible();

  // La transparencia del panel: aviso discreto de acceso vigente en el layout.
  await cliente.goto(`/panel/${companyId}/centros`);
  await expect(cliente.getByTestId('aviso-soporte-vigente')).toContainText(OPERADOR_A.email);
  await cliente.context().close();

  // El operador A entra a la vista de soporte (login con contraseña + TOTP).
  const operadorA = await nuevaPagina(browser);
  await ingresarOperador(operadorA, OPERADOR_A);
  await operadorA.goto(`/admin/soporte/${companyId}`);
  await expect(operadorA.getByTestId('banner-soporte')).toContainText('SOLO LECTURA');
  await expect(operadorA.getByTestId('soporte-ficha-nombre')).toHaveText(EMPRESA);

  // Regla 5 aplicada a la plataforma: la consulta quedó en la bitácora DEL TENANT.
  const eventos = await consultar<{ n: string }>(
    `select count(*) n from audit_log
     where company_id = $1 and event_type = 'soporte_vista_consultada'`,
    [companyId],
  );
  expect(Number(eventos[0]!.n)).toBeGreaterThan(0);
  await operadorA.context().close();

  // Decisión 5a (amenaza 15): el operador B, TAMBIÉN activo y con aal2, NO entra con
  // el grant de A — rebota a la ficha y NO deja evento de vista.
  const eventosAntes = Number(eventos[0]!.n);
  const operadorB = await nuevaPagina(browser);
  await altaOperador(operadorB, OPERADOR_B);
  await operadorB.goto(`/admin/soporte/${companyId}`);
  await expect(operadorB).toHaveURL(new RegExp(`/admin/organizaciones/${companyId}`));
  const eventosDespues = await consultar<{ n: string }>(
    `select count(*) n from audit_log
     where company_id = $1 and event_type = 'soporte_vista_consultada'`,
    [companyId],
  );
  expect(Number(eventosDespues[0]!.n)).toBe(eventosAntes);
  await operadorB.context().close();
});
