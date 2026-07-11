import { expect, test } from '@playwright/test';
import { datosE2E } from './utilidades';

test('un enlace expirado no permite responder', async ({ page }) => {
  const { tokens } = datosE2E();
  await page.goto(`/responder/${tokens.expirado}`);
  await expect(page.getByTestId('expirado')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('un token inexistente muestra enlace inválido', async ({ page }) => {
  await page.goto('/responder/token-que-no-existe');
  await expect(page.getByText('Enlace inválido')).toBeVisible();
});
