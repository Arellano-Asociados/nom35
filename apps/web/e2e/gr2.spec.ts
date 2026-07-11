import { expect, test } from '@playwright/test';
import { aceptarConsentimiento, completarYEnviar, datosE2E, responderFiltros } from './utilidades';

// GR-II (46 ítems, 16–50 trabajadores) sin condicionales aplicables (41–46 ocultos) →
// 40 preguntas. Todo "Nunca": grupo A (18–33, 16 ítems) vale 4 y grupo B vale 0;
// Cfinal = 16·4 = 64 → nivel MEDIO (45 ≤ 64 < 70).

test('flujo completo GR-II sin condicionales', async ({ page }) => {
  const { tokens } = datosE2E();
  await page.goto(`/responder/${tokens.gr2}`);

  await aceptarConsentimiento(page);
  await responderFiltros(page, 'No', 'No');

  await expect(page.getByText('Cuestionario GR-II')).toBeVisible();
  await expect(page.getByTestId('progreso')).toHaveText('0 / 40 respondidas');

  await completarYEnviar(page, 'Nunca');

  await expect(page.getByTestId('resultado-likert')).toBeVisible();
  await expect(page.getByText('calificación final 64')).toBeVisible();
  await expect(page.getByTestId('nivel-final')).toHaveText('Medio');
});
