import { defineConfig } from '@playwright/test';

// E2E del flujo del empleado. Requiere Supabase local corriendo (supabase start) con las
// migraciones aplicadas; el seed se hace en global-setup.ts.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 90_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    locale: 'es-MX',
    viewport: { width: 390, height: 844 }, // mobile-first
  },
  webServer: {
    command: 'pnpm exec next start --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Fase 6: el proveedor de IA simulado (texto determinista, sin red) permite el E2E
    // del flujo completo generar → adoptar sin llamar a la API real.
    env: { ...process.env, IA_SIMULADA: '1' },
  },
});
