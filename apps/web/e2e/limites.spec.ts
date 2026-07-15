import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

// E2E del limitador de tasa por la VÍA REST REAL (mini-fase post-F5). El hallazgo que
// motiva este spec: `rpc('golpe_limite')` resolvía contra `public`, la función solo
// existía en `app`, y TODA llamada caía en fail-open — el limitador estuvo apagado
// desde la Fase 2.5 sin que ningún gate lo detectara (la suite RLS lo probaba por SQL
// directo, no por PostgREST). Este spec cierra exactamente ese hueco:
//  1. La RPC expuesta APLICA el límite (con los parámetros reales de ARCO: 5/hora).
//  2. anon y authenticated no pueden ni ejecutarla.
//  3. El endpoint ARCO real (formulario público) rechaza la 6ª solicitud de la hora.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
// Llaves ESTÁNDAR del Supabase local (las imprime `supabase start`; no son secretos).
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function golpeRest(llave: string, clave: string): Promise<{ status: number; body: unknown }> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/golpe_limite`, {
    method: 'POST',
    headers: {
      apikey: llave,
      Authorization: `Bearer ${llave}`,
      'Content-Type': 'application/json',
    },
    // Parámetros REALES del endpoint ARCO (acciones/arco.ts): 5 por hora.
    body: JSON.stringify({ p_clave: clave, p_ventana_segundos: 3600, p_maximo: 5 }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

test('la RPC del limitador APLICA el límite por REST: la 6ª llamada de la hora devuelve false', async () => {
  const clave = `arco:e2e-rest-${randomUUID()}`;
  for (let i = 1; i <= 5; i++) {
    const r = await golpeRest(SERVICE_ROLE_KEY, clave);
    expect(r.status, `golpe ${i}`).toBe(200);
    expect(r.body, `golpe ${i} debe estar permitido`).toBe(true);
  }
  const sexta = await golpeRest(SERVICE_ROLE_KEY, clave);
  expect(sexta.status).toBe(200);
  expect(sexta.body, 'la 6ª llamada de la misma hora debe rechazarse').toBe(false);
});

test('ni anon puede ejecutar el limitador por REST (mismo contrato que app.golpe_limite)', async () => {
  const r = await golpeRest(ANON_KEY, `arco:e2e-anon-${randomUUID()}`);
  // Sin EXECUTE: PostgREST devuelve 401/403/404 según versión — lo importante es que
  // JAMÁS es 200 (un cliente no puede consumir ni resetear ventanas ajenas).
  expect(r.status).toBeGreaterThanOrEqual(400);
});

test('el endpoint ARCO real rechaza la 6ª solicitud de la misma IP en una hora', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  // IP única por corrida vía x-forwarded-for (ipCliente la toma del primer valor):
  // aísla la ventana del limitador de otras corridas y del resto de la suite.
  const octeto = () => Math.floor(Math.random() * 200) + 10;
  const ip = `10.${octeto()}.${octeto()}.${octeto()}`;
  const contexto = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': ip } });
  const page = await contexto.newPage();

  // El limitador se evalúa ANTES de validar la empresa (acciones/arco.ts), así que las
  // primeras 5 solicitudes con empresa inexistente CONSUMEN la ventana y prueban que
  // pasaron el límite (error de empresa, no de límite); la 6ª muere en el límite.
  for (let i = 1; i <= 5; i++) {
    await page.goto('/privacidad');
    await page
      .getByLabel('Nombre de la empresa donde trabajas o trabajaste')
      .fill(`Empresa Inexistente ${ip}`);
    await page.getByLabel('Tu nombre completo').fill('Persona E2E');
    await page.getByLabel('Tu correo electrónico').fill('arco-e2e@example.com');
    await page.getByLabel('Cuéntanos qué necesitas').fill('Prueba E2E del limitador.');
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(
      page.getByTestId('formulario-arco').getByRole('alert'),
      `solicitud ${i} debe pasar el límite`,
    ).toContainText('No encontramos una empresa');
  }

  await page.goto('/privacidad');
  await page
    .getByLabel('Nombre de la empresa donde trabajas o trabajaste')
    .fill(`Empresa Inexistente ${ip}`);
  await page.getByLabel('Tu nombre completo').fill('Persona E2E');
  await page.getByLabel('Tu correo electrónico').fill('arco-e2e@example.com');
  await page.getByLabel('Cuéntanos qué necesitas').fill('Sexta solicitud: debe rechazarse.');
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByTestId('formulario-arco').getByRole('alert')).toContainText(
    'Recibimos demasiadas solicitudes',
  );

  await contexto.close();
});
