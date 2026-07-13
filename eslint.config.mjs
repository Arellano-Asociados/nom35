import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
      'apps/web/next-env.d.ts',
      'supabase/.temp/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      // Regla 9 de CLAUDE.md: prohibido loggear respuestas/resultados.
      // console queda prohibido por defecto; excepciones explícitas con eslint-disable justificado.
      'no-console': 'error',
    },
  },
  {
    // Scripts de Node puro (fuera de apps/web y de los paquetes TypeScript): no hay tipos que
    // documenten los globals del runtime, así que se declaran explícitamente para el propio
    // ESLint (a diferencia de los .ts, aquí "no-undef" sí aplica).
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
      },
    },
  },
);
