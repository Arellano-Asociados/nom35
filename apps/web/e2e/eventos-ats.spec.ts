import { createHash, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { aceptarConsentimiento, responderSeccionActual } from './utilidades';

// E2E de los acontecimientos traumáticos severos (Fase 4.5: numerales 5.3, 5.5 y 6.5) y
// del registro 5.8 c). Recorre el ciclo completo del flujo reactivo: registrar el evento →
// aplicar la Guía I solo a los expuestos → el trabajador responde "Sí" (requiere valoración)
// → el Responsable Designado ve la canalización del ciclo ATS → descarga el registro 5.8 c),
// y se verifica EN BD que la generación quedó auditada (fail-closed, regla 5).

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const corrida = `${Date.now()}-${randomUUID().slice(0, 6)}`;
const ADMIN = { email: `ats-admin-${corrida}@e2e.mx`, password: 'Password123!Segura' };
const EMPRESA = `Eventos ATS ${corrida}`;
const EMPLEADO_EXPUESTO = `expuesto-${corrida}@e2e.mx`;
const EMPLEADO_AJENO = `ajeno-${corrida}@e2e.mx`;
const TOKEN_EXPUESTO = `e2e-ats-${corrida}`;

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

async function ingresar(page: Page) {
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Mis empresas')).toBeVisible();
}

let empresaId = '';
let eventoId = '';

test('preparación: empresa con dos trabajadores en un centro', async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto('/ingresar');
  await page.getByText('¿No tienes cuenta? Regístrate').click();
  await page.getByLabel('Correo electrónico').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByTestId('aviso-confirmacion')).toBeVisible();
  await consultar(`update auth.users set email_confirmed_at = now() where email = $1`, [
    ADMIN.email,
  ]);
  await ingresar(page);

  await page.getByText('Registrar una empresa nueva').click();
  await page.getByLabel('Razón social').fill(EMPRESA);
  await page.getByRole('button', { name: 'Registrar empresa' }).click();
  await expect(page.getByTestId('nombre-empresa')).toHaveText(EMPRESA);

  await page.getByLabel('Nombre', { exact: true }).fill('Sucursal Centro');
  await page.getByLabel('Número de trabajadores').fill('30');
  await page.getByRole('button', { name: 'Crear centro' }).click();
  await expect(page.getByTestId('lista-centros')).toContainText('GR-I + GR-II (16–50)');

  await page.goto(page.url().replace('/centros', '/empleados'));
  await page.getByLabel('Nombre completo').fill('Trabajador Expuesto');
  await page.getByLabel('Correo electrónico').fill(EMPLEADO_EXPUESTO);
  await page.getByRole('button', { name: 'Agregar empleado' }).click();
  await expect(page.getByTestId('lista-empleados')).toContainText('Trabajador Expuesto');

  await page.getByLabel('Nombre completo').fill('Trabajador Ajeno');
  await page.getByLabel('Correo electrónico').fill(EMPLEADO_AJENO);
  await page.getByRole('button', { name: 'Agregar empleado' }).click();
  await expect(page.getByTestId('lista-empleados')).toContainText('Trabajador Ajeno');

  const [empresa] = await consultar<{ id: string }>(
    `select id from companies where legal_name = $1`,
    [EMPRESA],
  );
  empresaId = empresa?.id ?? '';
  expect(empresaId).not.toBe('');
});

test('el evento se registra y la Guía I se aplica SOLO a los expuestos seleccionados', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await ingresar(page);

  await page.goto(`/panel/${empresaId}/eventos`);
  await page.getByLabel('Fecha del acontecimiento').fill('2026-07-13');
  await page.getByLabel('Descripción del hecho').fill('Asalto a mano armada en el turno nocturno');
  await page.getByRole('button', { name: 'Registrar acontecimiento' }).click();

  // El alta redirige al detalle del acontecimiento
  await expect(page.getByTestId('distribuir-evento')).toBeVisible();
  await expect(page.getByTestId('evento-asignados')).toHaveText('0');

  // Solo el expuesto: el otro trabajador del centro NO recibe cuestionario (6.5).
  // Se selecciona POR NOMBRE, no por posición: la lista va ordenada alfabéticamente y
  // "Trabajador Ajeno" precede a "Trabajador Expuesto".
  await page.getByRole('checkbox', { name: 'Trabajador Expuesto' }).check();
  await page.getByTestId('aplicar-gr1-evento').click();
  await page.getByTestId('aplicar-gr1-evento-confirmacion-confirmar').click();
  await expect(page.getByTestId('evento-asignados')).toHaveText('1', { timeout: 15_000 });

  const [evento] = await consultar<{ id: string }>(
    `select id from traumatic_events where company_id = $1`,
    [empresaId],
  );
  eventoId = evento?.id ?? '';
  expect(eventoId).not.toBe('');

  // El ciclo ATS existe, está marcado y trae UNA sola asignación, de GR-I, y es la del
  // trabajador EXPUESTO: la selección dirigida es el corazón del 6.5.
  const [ciclo] = await consultar<{ id: string; n: number; guias: string; correos: string }>(
    `select c.id,
            (select count(*)::int from questionnaire_assignments qa where qa.cycle_id = c.id) as n,
            (select string_agg(distinct q.code, ',') from questionnaire_assignments qa
               join questionnaires q on q.id = qa.questionnaire_id where qa.cycle_id = c.id) as guias,
            (select string_agg(e.email, ',') from questionnaire_assignments qa
               join employees e on e.id = qa.employee_id where qa.cycle_id = c.id) as correos
     from compliance_cycles c
     where c.company_id = $1 and c.traumatic_event_id = $2`,
    [empresaId, eventoId],
  );
  expect(ciclo?.n).toBe(1);
  expect(ciclo?.guias).toBe('GR-I');
  expect(ciclo?.correos).toBe(EMPLEADO_EXPUESTO);

  // El ciclo ATS NO aparece en la lista de Ciclos: es interno, no una evaluación del centro
  await page.goto(`/panel/${empresaId}/ciclos`);
  await expect(page.getByTestId('lista-ciclos')).not.toContainText('Evento ATS');
});

test('el expuesto responde la GR-I con acontecimiento y el RD ve su canalización', async ({
  page,
}) => {
  test.setTimeout(180_000);

  // Se sustituye el token del enlace enviado por uno conocido (el correo no viaja en E2E)
  const hash = createHash('sha256').update(TOKEN_EXPUESTO).digest('hex');
  await consultar(
    `update questionnaire_assignments qa set token_hash = $1
     where qa.id = (
       select qa2.id from questionnaire_assignments qa2
       join employees e on e.id = qa2.employee_id
       where qa2.company_id = $2 and e.email = $3
       limit 1
     )`,
    [hash, empresaId, EMPLEADO_EXPUESTO],
  );

  await page.goto(`/responder/${TOKEN_EXPUESTO}`);
  await aceptarConsentimiento(page);
  // El cuestionario debe haber MONTADO antes de contar fieldsets: locator.count() no
  // espera y contaría 0, dejando el cuestionario sin responder (ver utilidades.ts).
  await expect(page.getByText('Cuestionario sobre tu entorno de trabajo')).toBeVisible();

  // GR-I: un "Sí" en la Sección I (presenció/sufrió el acontecimiento) abre las
  // secciones II–IV; con "Sí" en todas, la Sección II (≥1 Sí) obliga valoración clínica.
  await responderSeccionActual(page, 'Sí');
  await expect(page.getByText('Sección 1 de 4')).toBeVisible();
  for (const seccion of [2, 3, 4]) {
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByText(`Sección ${seccion} de 4`)).toBeVisible();
    await responderSeccionActual(page, 'Sí');
  }

  await page.getByTestId('enviar').click();
  await expect(page.getByTestId('confirmacion')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('gr1-requiere')).toBeVisible();

  const [gr1] = await consultar<{ requiere_valoracion: boolean }>(
    `select g.requiere_valoracion from gr1_results g
     join compliance_cycles c on c.id = g.cycle_id
     where g.company_id = $1 and c.traumatic_event_id = $2`,
    [empresaId, eventoId],
  );
  expect(gr1?.requiere_valoracion).toBe(true);

  // El RD (designado sobre sí mismo) ve la canalización del ciclo ATS
  await ingresar(page);
  await page.goto(`/panel/${empresaId}/equipo`);
  await page.getByLabel('Cédula profesional (evidencia del responsable)').fill('CED-ATS');
  await page.getByTestId('designarme-rd').click();
  await page.getByTestId('designarme-rd-confirmacion-confirmar').click();
  await expect(page.getByTestId('soy-rd')).toBeVisible();

  await page.goto(`/panel/${empresaId}/eventos/${eventoId}`);
  await page.getByTestId('canalizaciones-evento').click();
  await expect(page.getByTestId('tabla-gr1')).toContainText('Trabajador Expuesto');
});

test('el RD descarga el registro 5.8 c) y la generación queda auditada', async ({ page }) => {
  test.setTimeout(120_000);
  await ingresar(page);

  const [cicloAts] = await consultar<{ id: string }>(
    `select id from compliance_cycles where company_id = $1 and traumatic_event_id = $2`,
    [empresaId, eventoId],
  );
  await page.goto(`/panel/${empresaId}/ciclos/${cicloAts?.id}/gr1`);

  const descarga = page.waitForEvent('download');
  await page.getByTestId('registro-58c').click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toBe('registro-5-8-c-examinados.csv');

  // Fail-closed (regla 5): sin evento en la bitácora no habría CSV. Debe existir.
  const [{ n }] = await consultar<{ n: number }>(
    `select count(*)::int as n from audit_log
     where company_id = $1 and event_type = 'registro_58c_generado'`,
    [empresaId],
  );
  expect(n).toBe(1);
});
