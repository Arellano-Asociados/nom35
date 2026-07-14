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
    // Fase 2.5 (auditoría v0, dimensión 10 [Alto]): el panel opera con el cliente de
    // SESIÓN para que RLS sea la defensa real. service_role (supabase-admin) queda
    // prohibido en las páginas del panel salvo en los consumidores de resultados
    // individuales (reglas 4/5: la agregación/lectura auditada es del servidor y esas
    // tablas no tienen GRANT para authenticated). Una página nueva que lo necesite
    // debe justificarse aquí, no colarse.
    files: ['apps/web/src/app/panel/**/*.tsx'],
    // OJO: los segmentos [empresa]/[ciclo] son clases de caracteres para minimatch,
    // así que las excepciones se expresan con comodines. Son los consumidores de
    // resultados individuales (dashboard/acciones agregan; gr1/individual son del RD).
    ignores: [
      'apps/web/src/app/panel/**/dashboard/page.tsx',
      'apps/web/src/app/panel/**/acciones/page.tsx',
      'apps/web/src/app/panel/**/gr1/page.tsx',
      'apps/web/src/app/panel/**/individual/page.tsx',
      'apps/web/src/app/panel/**/individual/*/page.tsx',
      'apps/web/src/app/panel/**/cuestionarios/*/resultados/page.tsx',
      'apps/web/src/app/panel/**/configuracion/page.tsx',
      // Fase 4: difusión agrega risk_results (vía lib/difusion-datos) igual que el
      // dashboard; buzón lee complaints (sin GRANT) con auditoría fail-closed.
      'apps/web/src/app/panel/**/difusion/page.tsx',
      'apps/web/src/app/panel/**/buzon/page.tsx',
      'apps/web/src/app/panel/**/buzon/*/page.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/supabase-admin',
              message:
                'Las páginas del panel usan clienteSesion() (RLS real). service_role solo en los consumidores de resultados listados en eslint.config.mjs.',
            },
            {
              name: '@/lib/difusion-datos',
              message:
                'Este módulo agrega con service_role: solo las páginas exceptuadas en eslint.config.mjs pueden consumirlo.',
            },
          ],
        },
      ],
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
