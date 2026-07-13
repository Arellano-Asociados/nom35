import { expect, test } from '@playwright/test';
import {
  aceptarConsentimiento,
  completarYEnviar,
  datosE2E,
  responderFiltros,
  responderSeccionActual,
} from './utilidades';

// GR-III (72 ítems, >50 trabajadores) con condicionales: atiende clientes SÍ (65–68 visibles),
// supervisa NO (69–72 ocultos y calificados como "Nunca" por el motor) → 68 preguntas.
// Todo "Algunas veces" (2 puntos): Cfinal = 68·2 = 136 → nivel ALTO (99 ≤ 136 < 140).

test('flujo completo GR-III con condicionales y guardado incremental', async ({ page }) => {
  const { tokens } = datosE2E();
  await page.goto(`/responder/${tokens.gr3}`);

  await aceptarConsentimiento(page);
  await responderFiltros(page, 'Sí', 'No');

  await expect(page.getByText('Cuestionario sobre tu entorno de trabajo')).toBeVisible();
  await expect(page.getByTestId('progreso')).toHaveText('0 / 68 respondidas');

  // Guardado incremental: responde la primera sección, espera a que no queden guardados
  // en vuelo, recarga y nada se pierde
  await responderSeccionActual(page, 'Algunas veces');
  await expect(page.getByTestId('progreso')).toHaveText('5 / 68 respondidas');
  await expect(page.getByTestId('progreso')).toHaveAttribute('data-guardando', '0');
  await page.reload();
  await expect(page.getByTestId('progreso')).toHaveText('5 / 68 respondidas');

  await completarYEnviar(page, 'Algunas veces');

  await expect(page.getByTestId('resultado-likert')).toBeVisible();
  await expect(page.getByText('calificación final 136')).toBeVisible();
  await expect(page.getByTestId('nivel-final')).toHaveText('Alto');

  // El empleado puede volver con su mismo enlace a consultar SU resultado
  await page.goto(`/responder/${tokens.gr3}`);
  await expect(page.getByTestId('confirmacion')).toBeVisible();
  await expect(page.getByTestId('nivel-final')).toHaveText('Alto');
});
