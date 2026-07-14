import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';

// E2E del flujo feliz del editor de cuestionarios personalizados (Fase 3):
// crear → editar (sección + preguntas de varios tipos) → vista previa → publicar
// (sellado, inmutable) → estado Publicado con huella visible.

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const corrida = `${Date.now()}-${randomUUID().slice(0, 6)}`;
const ADMIN = { email: `admin-cp-${corrida}@e2e.mx`, password: 'Password123!Segura' };
const EMPRESA = `Empresa CP ${corrida}`;

async function consultar(sql: string, params: unknown[]): Promise<void> {
  const cliente = new pg.Client({ connectionString: DB_URL });
  await cliente.connect();
  try {
    await cliente.query(sql, params);
  } finally {
    await cliente.end();
  }
}

async function registrarse(page: Page) {
  await page.goto('/ingresar');
  await page.getByText('¿No tienes cuenta? Regístrate').click();
  await page.getByLabel('Correo electrónico').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByTestId('aviso-confirmacion')).toBeVisible();
  await consultar(`update auth.users set email_confirmed_at = now() where email = $1`, [
    ADMIN.email,
  ]);
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Mis empresas')).toBeVisible();
}

test('el editor de cuestionarios personalizados: crear, editar, previsualizar y publicar sellado', async ({
  page,
}) => {
  test.setTimeout(120_000);

  await registrarse(page);
  await page.getByText('Registrar una empresa nueva').click();
  await page.getByLabel('Razón social').fill(EMPRESA);
  await page.getByRole('button', { name: 'Registrar empresa' }).click();
  await expect(page.getByTestId('nombre-empresa')).toHaveText(EMPRESA);

  // Crear el cuestionario desde su sección
  await page.goto(page.url().replace('/centros', '/cuestionarios'));
  await page.getByLabel('Título').fill('Pulso de clima');
  await page.getByRole('button', { name: 'Crear y abrir el editor' }).click();

  // Editor: una sección con dos preguntas de tipos distintos
  await page.getByTestId('cp-agregar-seccion').click();
  await page.getByLabel('Título de la sección 1').fill('General');
  await page.getByTestId('cp-agregar-pregunta-0').click();
  await page
    .getByLabel('Pregunta 1 de la sección 1')
    .fill('¿Cómo calificas el ambiente de trabajo?');
  await page.getByTestId('cp-agregar-pregunta-0').click();
  await page.getByLabel('Pregunta 2 de la sección 1').fill('¿Recomendarías trabajar aquí?');
  await page.getByLabel('Tipo de pregunta').nth(1).selectOption('si_no');

  await page.getByTestId('cp-guardar').click();
  await expect(page.getByText('Borrador guardado')).toBeVisible();

  // Vista previa: exactamente el renderizador del empleado, en marco móvil
  await page.getByTestId('cp-previa').click();
  await expect(page.getByTestId('cp-marco-previa')).toBeVisible();
  await expect(page.getByText('¿Cómo calificas el ambiente de trabajo?')).toBeVisible();
  await page.getByTestId('cp-previa').click();

  // Publicar (confirmación explícita) → estado publicado, sellado e inmutable
  await page.getByTestId('cp-publicar').click();
  await page.getByTestId('cp-publicar-confirmacion-confirmar').click();
  await expect(page.getByTestId('cp-estado')).toContainText('Publicado');
  await expect(page.getByText('huella de integridad')).toBeVisible();

  // Lista con el estado reflejado
  await page.goto(page.url().replace(/\/cuestionarios\/.*$/, '/cuestionarios'));
  await expect(page.getByTestId('lista-cuestionarios')).toContainText('Pulso de clima');
  await expect(page.getByTestId('lista-cuestionarios')).toContainText('Publicado');
});
