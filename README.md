# Constata — Plataforma SaaS de cumplimiento NOM-035-STPS-2018

Constata digitaliza el ciclo completo de cumplimiento de la **NOM-035-STPS-2018** (factores de
riesgo psicosocial en el trabajo, México): distribución de los cuestionarios oficiales (Guías
de Referencia I, II y III del DOF), cálculo con las matrices de la propia norma, dashboards
agregados, informe normativo (numeral 7.7) y **expediente de inspección descargable con
evidencia inmutable exhibible ante la STPS**.

Es **multi-tenant** (pensada también para consultoras que atienden varias empresas) y su
diferenciador es la **evidencia auditable e inmutable**: el producto nunca permite editar
respuestas ni resultados, y los datos de los cuestionarios se tratan como **datos personales
sensibles de salud** bajo la LFPDPPP — nadie del lado patronal ve respuestas crudas jamás.

> Documentación relacionada:
> [Manual de usuario](docs/MANUAL_USUARIO.md) ·
> [Arquitectura](docs/ARQUITECTURA.md) ·
> [Despliegue](docs/DESPLIEGUE.md) ·
> [Manual de QA](docs/MANUAL_QA.md) ·
> [Changelog](CHANGELOG.md) ·
> [Auditoría](docs/AUDITORIA.md) ·
> [Contexto para desarrollo (CLAUDE.md)](CLAUDE.md)

## Stack

- **Next.js 15** (App Router, TypeScript) — `apps/web`
- **Supabase**: PostgreSQL con Row Level Security, Auth (contraseña + TOTP), Storage
- **Tailwind + shadcn/ui**, es-MX, responsive y accesible
- **Motor de cálculo** como paquete TypeScript puro sin dependencias de framework —
  `packages/motor-nom035` (TDD estricto)
- Correo transaccional detrás de una interfaz `MailProvider` (Resend en producción, Mailpit en
  local)
- Asistencia por IA detrás de una interfaz `ProveedorIA` (API de Anthropic; la llamada sale del
  servidor)
- Deploy objetivo: **Vercel + Supabase Pro** (ver [DESPLIEGUE.md](docs/DESPLIEGUE.md))

## Estructura del monorepo (pnpm)

```
apps/web/                 # Next.js 15: panel, flujo del empleado, portal /admin, E2E (Playwright)
packages/motor-nom035/    # Motor de cálculo puro (funciones sin I/O, sin framework)
packages/pruebas-rls/     # Suite de aislamiento multi-tenant (gate de CI)
supabase/                 # Migraciones SQL, políticas RLS, seeds normativos
scripts/                  # Seeds de demo, verificación de textos, operador de plataforma, purga
docs/                     # Manuales, arquitectura, despliegue, auditoría, specs de diseño
.github/workflows/        # CI: lint + typecheck + tests + RLS + E2E (gates innegociables)
```

## Arranque local

**Requisitos:** Node ≥22, pnpm ≥10, **Docker Desktop** (para el Supabase local).

```bash
pnpm install
pnpm exec supabase start          # levanta Postgres/Auth/Storage locales en Docker
pnpm exec supabase db reset       # aplica todas las migraciones + seeds normativos desde cero
cp apps/web/.env.example apps/web/.env.local   # y llena los valores (ver abajo)
pnpm --filter web dev             # http://localhost:3000
```

Las llaves locales (`ANON_KEY`, `SERVICE_ROLE_KEY`, etc.) las imprime `pnpm exec supabase start`
— son llaves de desarrollo estándar, no secretos. Cópialas a `apps/web/.env.local`.

### Sembrar la demo comercial

```bash
pnpm seed:demo   # dataset "Constata Demo": 2 orgs, 3 centros, 62 empleados, ciclos, IA, buzón…
```

Idempotente (correrlo dos veces no duplica) y con **guard anti-producción** (rechaza URLs no
locales salvo `DEMO_ALLOW=1`). Imprime las cuentas de demo al terminar. El guion de QA que
recorre este dataset está en [docs/MANUAL_QA.md](docs/MANUAL_QA.md); sus verificaciones
automatizables se corren con `node scripts/qa-verificacion.mjs`.

### Probar la asistencia por IA sin API key

La generación por IA (resumen ejecutivo y plan de acción) sale del servidor y necesita
`ANTHROPIC_API_KEY`. Para demostrarla **sin** una key real, arranca con el proveedor simulado
(texto determinista, sin red):

```bash
IA_SIMULADA=1 pnpm --filter web dev
```

El flag `ia_asistida` de la organización debe estar activo (el seed lo deja activo en la Org 1).

### El portal de plataforma (`/admin`)

No tiene registro público. Crea el primer operador una vez por entorno:

```bash
pnpm operador:crear operador@constata.mx "OperadorDemo!2026"
```

En su primer acceso a `/admin`, el operador debe enrolar TOTP (obligatorio).

### Tropiezos conocidos en local (ya resueltos, aquí como instrucciones)

- **Docker debe estar corriendo** antes de `supabase start`. En Windows, el arranque a veces
  tarda; espera a que el daemon responda.
- **`mfa_totp_enroll_not_enabled` al enrolar TOTP** pese a tener `[auth.mfa.totp]` habilitado en
  `supabase/config.toml`: el contenedor de auth quedó de antes del cambio. `pnpm exec supabase
stop && pnpm exec supabase start` lo recrea (`db reset` NO recrea el contenedor de auth).
- **Windows:** no reescribas archivos fuente con `Get-Content`/`Set-Content` de PowerShell 5.1
  (leen UTF-8 sin BOM como ANSI y corrompen los acentos). Usa un editor o herramientas que
  respeten UTF-8.
- `[analytics]` está deshabilitado en `config.toml` a propósito: en Windows, Logflare exige el
  daemon de Docker por TCP y tumbaba el arranque de `supabase start`.

## Comandos

| Comando                                     | Qué hace                                                 |
| ------------------------------------------- | -------------------------------------------------------- |
| `pnpm --filter web dev`                     | Servidor de desarrollo (http://localhost:3000)           |
| `pnpm lint`                                 | ESLint + Prettier (sin warnings; gate de CI)             |
| `pnpm typecheck`                            | TypeScript estricto en todos los paquetes                |
| `pnpm test`                                 | Suite del motor + unit de la app                         |
| `pnpm --filter @nom35/pruebas-rls test:rls` | Aislamiento multi-tenant (requiere BD local; gate de CI) |
| `pnpm --filter web exec playwright test`    | E2E de flujos críticos (Playwright)                      |
| `pnpm exec supabase db reset`               | Re-aplica migraciones + seeds desde cero                 |
| `pnpm seed:demo`                            | Siembra el dataset de demo comercial                     |
| `pnpm demo:seed`                            | Seed de demo más pequeño (guion en `docs/demo.md`)       |
| `pnpm operador:crear <correo> <contraseña>` | Bootstrap del primer operador de `/admin`                |
| `pnpm verificar:textos`                     | Verifica que los 138 ítems oficiales no derivaron (gate) |
| `node scripts/qa-verificacion.mjs`          | Verificaciones automatizables del manual de QA           |

## Reglas de negocio inviolables

El producto está gobernado por reglas que no admiten excepciones ni flags de configuración
(inmutabilidad de la evidencia, prohibición de promedios, supresión anti-reidentificación con
n<3, respuestas crudas fuera del alcance de todo rol patronal, tenancy derivada del JWT, nada
normativo hardcodeado). Están enumeradas en [CLAUDE.md §3](CLAUDE.md) y explicadas en
[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Estado

MVP **v1.0** — el ciclo normativo completo, el portal de plataforma y la asistencia por IA están
implementados y validados (motor, unit de la app, aislamiento RLS y E2E como gates de CI). Antes
de un piloto con datos reales quedan **dependencias externas** (validación del motor por un
consultor certificado, redacción legal del aviso de privacidad y el DPA, criterio legal de
retención): ver la **lista de bloqueo** al inicio de [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).
