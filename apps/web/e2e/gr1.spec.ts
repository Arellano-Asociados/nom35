import { expect, test } from '@playwright/test';
import pg from 'pg';
import { aceptarConsentimiento, datosE2E, responderSeccionActual } from './utilidades';

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// GR-I no tiene preguntas filtro ni puntaje.

test('GR-I sin acontecimiento: termina en la Sección I y no requiere valoración', async ({
  page,
}) => {
  const { tokens } = datosE2E();
  await page.goto(`/responder/${tokens.gr1SinEvento}`);

  await aceptarConsentimiento(page);
  await expect(page.getByText('Cuestionario GR-I')).toBeVisible();

  // Con todas "No" en la Sección I, no aparecen las secciones II–IV
  await responderSeccionActual(page, 'No');
  await expect(page.getByText('Sección 1 de 1')).toBeVisible();

  await page.getByTestId('enviar').click();
  await expect(page.getByTestId('confirmacion')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('gr1-no-requiere')).toBeVisible();
});

test('GR-I con acontecimiento y afectación: requiere valoración y notifica al RD', async ({
  page,
}) => {
  const { tokens, companyId } = datosE2E();
  await page.goto(`/responder/${tokens.gr1ConEvento}`);

  await aceptarConsentimiento(page);
  await expect(page.getByText('Cuestionario GR-I')).toBeVisible();

  // Sección I: un "Sí" habilita las secciones II–IV
  const preguntasI = page.locator('fieldset');
  await preguntasI.nth(0).getByText('Sí', { exact: true }).click();
  const totalI = await preguntasI.count();
  for (let i = 1; i < totalI; i++) {
    await preguntasI.nth(i).getByText('No', { exact: true }).click();
  }
  await expect(page.getByText('Sección 1 de 4')).toBeVisible();

  // Sección II: todas No
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await responderSeccionActual(page, 'No');
  // Sección III: todas No
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await responderSeccionActual(page, 'No');
  // Sección IV: dos "Sí" (≥2 dispara valoración clínica)
  await page.getByRole('button', { name: 'Siguiente' }).click();
  const preguntasIV = page.locator('fieldset');
  await preguntasIV.nth(0).getByText('Sí', { exact: true }).click();
  await preguntasIV.nth(1).getByText('Sí', { exact: true }).click();
  const totalIV = await preguntasIV.count();
  for (let i = 2; i < totalIV; i++) {
    await preguntasIV.nth(i).getByText('No', { exact: true }).click();
  }

  await page.getByTestId('enviar').click();
  await expect(page.getByTestId('confirmacion')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('gr1-requiere')).toBeVisible();

  // La notificación al Responsable Designado queda auditada
  const cliente = new pg.Client({ connectionString: DB_URL });
  await cliente.connect();
  try {
    const { rows } = await cliente.query(
      `select count(*)::int as n from audit_log
       where company_id = $1 and event_type = 'gr1_notificacion_dr'`,
      [companyId],
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  } finally {
    await cliente.end();
  }
});
