import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

export interface DatosE2E {
  tokens: {
    gr3: string;
    gr2: string;
    gr1SinEvento: string;
    gr1ConEvento: string;
    expirado: string;
  };
  companyId: string;
}

export function datosE2E(): DatosE2E {
  return JSON.parse(readFileSync(join(__dirname, '.datos-e2e.json'), 'utf-8')) as DatosE2E;
}

export async function aceptarConsentimiento(page: Page): Promise<void> {
  await expect(page.getByText('Aviso de privacidad y consentimiento')).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click();
}

export async function responderFiltros(
  page: Page,
  atiende: 'Sí' | 'No',
  supervisa: 'Sí' | 'No',
): Promise<void> {
  await expect(page.getByText('Antes de comenzar')).toBeVisible();
  const grupos = page.locator('fieldset');
  await grupos.nth(0).getByText(atiende, { exact: true }).click();
  await grupos.nth(1).getByText(supervisa, { exact: true }).click();
  await page.getByRole('button', { name: 'Comenzar cuestionario' }).click();
  // locator.count() no espera: hay que confirmar que el cuestionario ya montó su primera
  // sección antes de que completarYEnviar empiece a contar fieldsets, o se cuenta 0/stale.
  await expect(page.getByTestId('progreso')).toBeVisible();
}

/** Responde todas las preguntas visibles de la sección actual con la opción dada.
 * Espera a que cada clic quede reflejado en el estado (radio marcado) antes de avanzar:
 * bajo carga de CI un clic disparado sin confirmar puede perderse en un re-render y dejar
 * el contador de "respondidas" permanentemente corto, bloqueando el botón Enviar para siempre. */
export async function responderSeccionActual(page: Page, opcion: string): Promise<void> {
  const preguntas = page.locator('fieldset');
  const total = await preguntas.count();
  for (let i = 0; i < total; i++) {
    const pregunta = preguntas.nth(i);
    await pregunta.getByText(opcion, { exact: true }).click();
    await expect(pregunta.getByRole('radio', { name: opcion, exact: true })).toBeChecked();
  }
}

/** Recorre todas las secciones respondiendo con la opción dada y envía el cuestionario.
 * Tras cada "Siguiente" espera a que la etiqueta de sección cambie antes de volver a contar
 * los fieldsets: sin esto, responderSeccionActual puede contar la sección VIEJA (aún no
 * desmontada) y solo recorrer sus primeros N ítems, dejando ítems de la sección nueva sin
 * responder para siempre (el contador global queda corto y el botón Enviar nunca se habilita). */
export async function completarYEnviar(page: Page, opcion: string): Promise<void> {
  const etiquetaSeccion = page.getByText(/^Sección \d+ de \d+$/);
  for (;;) {
    await responderSeccionActual(page, opcion);
    const siguiente = page.getByRole('button', { name: 'Siguiente' });
    if (await siguiente.isVisible()) {
      const anterior = await etiquetaSeccion.textContent();
      await siguiente.click();
      await expect(etiquetaSeccion).not.toHaveText(anterior ?? '');
    } else {
      break;
    }
  }
  await page.getByTestId('enviar').click();
  await expect(page.getByTestId('confirmacion')).toBeVisible({ timeout: 30_000 });
}
