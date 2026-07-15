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
    // Fase 5, guardia (b) del spec §8: lib/soporte-datos es la allow-list de la vista
    // de soporte y NO se consume fuera de app/admin/**/soporte/** — que la frontera no
    // se cruce ni por accidente. (Los bloques posteriores que redefinen
    // no-restricted-imports para archivos específicos repiten esta ruta.)
    // Fase 6 añade a esta guardia general las fronteras de IA: la allow-list ia-datos y
    // el SDK de Anthropic solo se consumen en sus lugares (overrides más abajo).
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/app/admin/**/soporte/**', 'apps/web/src/lib/soporte-datos.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/soporte-datos',
              message:
                'La allow-list de soporte solo se consume desde app/admin/**/soporte/** (spec Fase 5 §8).',
            },
            {
              name: '@/lib/ia/ia-datos',
              message:
                'La allow-list de IA solo se consume desde acciones/ia.ts (spec Fase 6 §2): la IA jamás recibe datos fuera de este módulo.',
            },
            {
              name: '@anthropic-ai/sdk',
              message:
                'El SDK de Anthropic solo se importa en lib/ia/proveedor.ts (spec Fase 6 §3): la llamada sale del servidor tras la interfaz ProveedorIA.',
            },
          ],
        },
      ],
    },
  },
  {
    // Fase 5, guardia (a): las páginas de la vista de soporte consumen EXCLUSIVAMENTE
    // lib/soporte-datos (columnas explícitas, jamás select('*')). service_role directo
    // queda prohibido ahí — el camino pavimentado es angosto a propósito (§7.1). Fase 6:
    // tampoco cruzan hacia la allow-list de IA ni al SDK.
    files: ['apps/web/src/app/admin/**/soporte/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/supabase-admin',
              message:
                'Las páginas de soporte consumen SOLO lib/soporte-datos (allow-list de columnas explícitas).',
            },
            {
              name: '@/lib/ia/ia-datos',
              message: 'La allow-list de IA solo se consume desde acciones/ia.ts (spec Fase 6 §2).',
            },
            {
              name: '@anthropic-ai/sdk',
              message:
                'El SDK de Anthropic solo se importa en lib/ia/proveedor.ts (spec Fase 6 §3).',
            },
          ],
        },
      ],
    },
  },
  {
    // Fase 6, override: lib/ia/proveedor.ts es el ÚNICO que puede importar el SDK de
    // Anthropic. Conserva la prohibición de soporte-datos e ia-datos (no los importa).
    files: ['apps/web/src/lib/ia/proveedor.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/soporte-datos',
              message: 'La allow-list de soporte no se consume aquí (spec Fase 5 §8).',
            },
            {
              name: '@/lib/ia/ia-datos',
              message: 'ia-datos solo se consume desde acciones/ia.ts (spec Fase 6 §2).',
            },
          ],
        },
      ],
    },
  },
  {
    // Fase 6, override: acciones/ia.ts es el ÚNICO que consume la allow-list ia-datos.
    // Sigue sin poder importar el SDK directo (usa la interfaz ProveedorIA).
    files: ['apps/web/src/acciones/ia.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/soporte-datos',
              message: 'La allow-list de soporte no se consume aquí (spec Fase 5 §8).',
            },
            {
              name: '@anthropic-ai/sdk',
              message:
                'El SDK de Anthropic solo se importa en lib/ia/proveedor.ts (spec Fase 6 §3).',
            },
          ],
        },
      ],
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
      // Fase 5 (spec §6.3): la página de soporte resuelve id→email del operador con una
      // lectura puntual de platform_users (el tenant no puede leerla y el display JAMÁS
      // confía en el query string). El grant en sí se INSERTA con la sesión (RLS).
      'apps/web/src/app/panel/**/soporte/page.tsx',
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
            // Fase 5, guardia (c): las fronteras plataforma↔tenant no se cruzan.
            {
              name: '@/lib/autorizacion-plataforma',
              message:
                'La identidad de plataforma no entra al panel del tenant (Fase 5 §8): las fronteras no se cruzan ni por accidente.',
            },
            {
              name: '@/lib/soporte-datos',
              message:
                'La allow-list de soporte solo se consume desde app/admin/**/soporte/** (spec Fase 5 §8).',
            },
            {
              name: '@/lib/ia/ia-datos',
              message: 'La allow-list de IA solo se consume desde acciones/ia.ts (spec Fase 6 §2).',
            },
            {
              name: '@anthropic-ai/sdk',
              message:
                'El SDK de Anthropic solo se importa en lib/ia/proveedor.ts (spec Fase 6 §3).',
            },
          ],
        },
      ],
    },
  },
  {
    // Fase 5, guardia (c) para las páginas del panel EXCEPTUADAS del bloque anterior
    // (consumidores de resultados): también ellas tienen prohibido cruzar la frontera
    // de plataforma. (Este bloque redefine no-restricted-imports para esos archivos,
    // que conservan su permiso de supabase-admin/difusion-datos.)
    files: [
      'apps/web/src/app/panel/**/dashboard/page.tsx',
      'apps/web/src/app/panel/**/acciones/page.tsx',
      'apps/web/src/app/panel/**/gr1/page.tsx',
      'apps/web/src/app/panel/**/individual/page.tsx',
      'apps/web/src/app/panel/**/individual/*/page.tsx',
      'apps/web/src/app/panel/**/cuestionarios/*/resultados/page.tsx',
      'apps/web/src/app/panel/**/configuracion/page.tsx',
      'apps/web/src/app/panel/**/difusion/page.tsx',
      'apps/web/src/app/panel/**/buzon/page.tsx',
      'apps/web/src/app/panel/**/buzon/*/page.tsx',
      'apps/web/src/app/panel/**/soporte/page.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/autorizacion-plataforma',
              message:
                'La identidad de plataforma no entra al panel del tenant (Fase 5 §8): las fronteras no se cruzan ni por accidente.',
            },
            {
              name: '@/lib/soporte-datos',
              message:
                'La allow-list de soporte solo se consume desde app/admin/**/soporte/** (spec Fase 5 §8).',
            },
            {
              name: '@/lib/ia/ia-datos',
              message: 'La allow-list de IA solo se consume desde acciones/ia.ts (spec Fase 6 §2).',
            },
            {
              name: '@anthropic-ai/sdk',
              message:
                'El SDK de Anthropic solo se importa en lib/ia/proveedor.ts (spec Fase 6 §3).',
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
