import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Igual que el runtime automático de JSX que usa Next.js/SWC para el resto
  // de la app: necesario para que Vitest (esbuild) transforme el JSX de
  // `@react-pdf/renderer` sin requerir `import React` explícito en cada archivo.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
