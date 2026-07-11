import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Una sola conexión lógica contra la BD local: sin paralelismo entre archivos
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
