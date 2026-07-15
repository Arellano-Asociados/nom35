# CLAUDE.md — Plataforma SaaS de Cumplimiento NOM-035-STPS-2018

Memoria persistente del proyecto. **Leer completo antes de trabajar en cualquier sesión.**

## 1. Qué es este producto

MVP de una plataforma SaaS **multi-tenant** que digitaliza el cumplimiento de la
**NOM-035-STPS-2018** (factores de riesgo psicosocial en el trabajo, México). La norma obliga a
todos los centros de trabajo a aplicar cuestionarios oficiales (Guías de Referencia I, II y III
del DOF 23-oct-2018), procesarlos con matrices definidas en la propia norma, determinar niveles
de riesgo, tomar acciones y conservar **evidencia documental exhibible ante inspecciones de la
STPS** (evidencia electrónica válida; multas de 250 a 5,000 UMA por infracción, art. 994-V LFT).

Ciclo completo que automatiza la plataforma: registro de empresas/centros de trabajo/empleados →
distribución de cuestionarios por enlace tokenizado → captura inmutable de respuestas → cálculo
automático con matrices oficiales → dashboards agregados → informe normativo (numeral 7.9) y
expediente de inspección descargable.

**Diferenciador central:** evidencia auditable e inmutable (el producto NO permite editar
respuestas ni resultados jamás) y arquitectura multi-empresa pensada también para consultoras
que atienden múltiples clientes.

- Segmento inicial: empresas de 101–500 empleados. Meta año 1: ~200 organizaciones.
- Los resultados de los cuestionarios son **DATOS PERSONALES SENSIBLES (salud)** bajo la
  LFPDPPP vigente (DOF 20-mar-2025; autoridad: Secretaría Anticorrupción y Buen Gobierno).
  Esto gobierna el diseño de permisos: nadie del lado patronal ve respuestas crudas nunca; los
  resultados individuales procesados solo los ve un "Responsable Designado" con cada consulta
  auditada.

## 2. Stack y arquitectura (decisión cerrada — NO reabrir)

- **Next.js 15 (App Router, TypeScript) + Supabase** (PostgreSQL con Row Level Security, Auth
  con magic links, Storage) + Tailwind + shadcn/ui. Deploy objetivo: Vercel + Supabase Pro.
- Motor de cálculo como **paquete TypeScript puro sin dependencias de framework** en
  `packages/motor-nom035`, consumido por la app. Razón: el riesgo dominante es corrección
  normativa y aislamiento de datos; el motor aislado se valida exhaustivamente y es portable;
  RLS garantiza aislamiento a nivel de BD independiente del código.
- Correo transaccional vía Resend (o equivalente) detrás de una interfaz `MailProvider`.
- Monorepo pnpm: `apps/web` (Next.js; E2E Playwright en `apps/web/e2e`),
  `packages/motor-nom035` (funciones puras, sin I/O, sin framework), `packages/pruebas-rls`
  (aislamiento multi-tenant, gate de CI), `supabase/` (migraciones, RLS, seeds),
  `.github/workflows/` (lint + typecheck + tests + RLS + E2E como gates).

**Convenciones específicas por paquete** (se cargan solas al trabajar ahí):
`apps/web/CLAUDE.md` (flujo del empleado, trampas de Next/Playwright, `clienteSesion()` vs
`service_role`) y `packages/motor-nom035/CLAUDE.md` (reglas normativas de GR-I/II/III).

## 3. REGLAS DE NEGOCIO INVIOLABLES

Estas reglas no admiten excepciones, flags de configuración ni "casos especiales":

1. **Inmutabilidad:** `responses` y `risk_results` son INMUTABLES: append-only, nunca
   UPDATE/DELETE; recálculo = fila nueva con `supersedes_id`. Triggers en BD rechazan
   modificaciones.
2. **Sin promedios:** los resultados NUNCA se promedian entre empleados. Agregados =
   distribuciones y conteos.
3. **Anti-reidentificación:** toda vista agregada suprime celdas con **n < 3** y, si
   alguna celda se suprime, **se enmascara la FILA COMPLETA**: todas las celdas
   (incluidos los ceros) y el total. Razón (auditoría v0): suprimir solo la celda con
   datos oculta el CONTEO pero no el ATRIBUTO — publicar ceros a su lado revela el
   nivel del individuo. Aplica igual al informe exportable. Limitación abierta: el
   dashboard se recalcula en vivo, así que la inferencia por diferencia temporal
   (consultar antes y después de cada respuesta) sigue siendo posible; cerrarla exige
   publicar instantáneas en vez de agregados en vivo.
4. **Respuestas crudas: nadie patronal.** Ningún rol patronal (Admin Org, Consultor,
   Responsable Designado, Admin Plataforma) puede leer respuestas crudas ítem por ítem.
   Sin excepciones, sin flags.
5. **Resultados individuales procesados:** solo el Responsable Designado; cada consulta genera
   evento `individual_result_access` en `audit_log` (append-only).
6. **Tenancy:** `company_id` se deriva SIEMPRE del JWT, jamás del request. Toda tabla de tenant
   tiene RLS activo. Los tests de aislamiento entre tenants son **gate de CI**.
7. **Nada normativo hardcodeado:** matrices y rangos viven en TABLAS DE DATOS
   (`scoring_rules`, `item_structure`, `risk_level_ranges`), nunca en el código del motor.
8. **Categoría normativa** de un centro de trabajo derivada de su headcount con umbrales
   15/16 y 50/51: ≤15 → solo GR-I; 16–50 → GR-I+GR-II; >50 → GR-I+GR-III.
9. **Logs limpios:** prohibido loggear respuestas o resultados en logs de aplicación.
   Prohibido hardcodear secretos (solo variables de entorno; `.env` en `.gitignore`).

## 4. Convenciones

- **Toda fase inicia committeando su plan a `docs/superpowers/plans/` antes de implementar.**
  (Y su spec de diseño a `docs/superpowers/specs/`.) Si la sesión se interrumpe, el plan
  committeado es lo único que permite retomar sin reconstruir el contexto.
- **Commits atómicos** con mensajes descriptivos **en español**. Una rama por milestone.
- **TDD estricto en el motor** (test primero, luego implementación). Unit + integración en el
  resto; E2E (Playwright) para flujos críticos.
- Migraciones SQL versionadas y reproducibles desde cero; seeds idempotentes.
- Componentes con shadcn/ui; UI íntegramente en **es-MX**, responsive y accesible (labels,
  contraste, navegación por teclado en el cuestionario).
- Lint + typecheck sin warnings. Gates de CI innegociables: lint, typecheck, suite del motor,
  tests de aislamiento multi-tenant.
- TypeScript estricto en todos los paquetes (`tsconfig.base.json`).

### Comandos no obvios

```bash
pnpm exec supabase db reset              # Re-aplica migraciones + seeds desde cero
pnpm --filter @nom35/pruebas-rls test:rls # Aislamiento multi-tenant (requiere BD local arriba)
pnpm demo:seed                            # Siembra datos de demo (guion en docs/demo.md)
pnpm operador:crear <correo> <contraseña> # Bootstrap del primer operador de /admin (una vez por entorno)
node scripts/purgar-empresa.mjs <id>      # Purga física tras retención (acta-inventario; doble confirmación)
```

OJO local: si GoTrue responde `mfa_totp_enroll_not_enabled` pese a `[auth.mfa.totp]` en
`config.toml`, el contenedor de auth es viejo: `supabase stop && supabase start` (el
`db reset` no recrea el contenedor de auth).

Los estándar (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm exec supabase start`) están en
los scripts del `package.json`. Manual de uso completo (guías de Administrador y de empleado,
diagramas, tabla de permisos por rol, FAQ): `docs/manual.md`.

### Convenciones de base de datos

- No hay default privileges: **toda tabla nueva necesita GRANT explícito** por rol
  (mínimo privilegio) además de sus políticas RLS. `responses` no tiene GRANT de SELECT
  para `authenticated` a propósito.
- FKs compuestas `(company_id, id)` en las cadenas de tenant (anti-cruce de empresa).
- El claim `company_id` del JWT lo pone el hook `app.custom_access_token` desde la
  membresía real; las políticas SIEMPRE re-verifican membresía (claim solo no basta).
- El hook corre como `supabase_auth_admin` y necesita `GRANT USAGE ON SCHEMA app` además del
  `GRANT EXECUTE`: sin eso **todo** signup/login con contraseña falla con 500 (ni el flujo del
  empleado ni la suite RLS lo ejercitan, así que no se detecta hasta el primer E2E del panel).
- `[analytics]` está deshabilitado en `config.toml`: en Windows, Logflare exige el daemon de
  Docker por TCP y tumba el arranque de `supabase start`.
- La suite de `packages/pruebas-rls` corre en CI con Supabase en Docker; localmente
  requiere Docker Desktop.

## 5. Estado de milestones

Bitácora detallada de lo construido en cada uno: **`docs/historia-milestones.md`**.

| Milestone | Descripción                                                  | Estado                                                   |
| --------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| M0        | Init repo, monorepo, CI, Supabase local                      | ✅                                                       |
| M1        | Motor de cálculo + suite de validación                       | 🟡 Cerrado _para desarrollo_ (ver dependencias abiertas) |
| M2        | Base de datos, multi-tenancy y auth (RLS)                    | ✅                                                       |
| M3        | Flujo del empleado + captura inmutable                       | ✅                                                       |
| M4        | Panel administrativo                                         | ✅                                                       |
| M5        | Informe de resultados y expediente de inspección             | ✅                                                       |
| M6        | Endurecimiento y demo                                        | ✅                                                       |
| M7        | Manual de uso y UI premium                                   | ✅                                                       |
| F1.5      | Remediación de críticos de la auditoría v0                   | ✅ (`docs/AUDITORIA.md`)                                 |
| F2        | Sistema de diseño e identidad **Constata**                   | ✅ (`docs/BRAND.md`)                                     |
| F2.5      | Endurecimiento estructural (RLS real en el panel)            | ✅                                                       |
| F3        | Configurabilidad (cuestionarios propios, plantillas, cron)   | ✅                                                       |
| F4        | Ciclo normativo completo (difusión, buzón, programa 8.3–8.5) | ✅ (2026-07-14)                                          |
| F4.5      | Remates normativos (eventos ATS, informe 7.7, registros 5.8) | ✅ (2026-07-14) — deuda normativa VACÍA                  |
| F5        | Portal super-admin de plataforma (/admin)                    | ✅ (2026-07-14) — v0.7.0                                 |
| F6        | Inteligencia y experiencia ejecutiva (dashboard + IA)        | ✅ (2026-07-15) — v0.8.0                                 |
| F7        | Empaque de demo y QA manual (`seed:demo`, MANUAL_QA)         | ✅ (2026-07-15) — v0.9.0                                 |

Estado de validación tras F7: motor 59/59, web 202/202, RLS 91/91, E2E 29/29.

**Empaque de demo (F7):** `pnpm seed:demo` (`scripts/seed-demo.mjs`) siembra el dataset
comercial "Constata Demo" (2 organizaciones, 3 centros de los tres tamaños normativos,
62 empleados, ciclo completado con los 5 niveles del semáforo, ciclo en curso, evento
ATS, programa, quejas, difusión, cuestionario propio y borradores de IA) — idempotente y
con guard anti-producción. `docs/MANUAL_QA.md` es el guion de QA manual; sus filas "Auto"
se corren con `node scripts/qa-verificacion.mjs` contra el seed.

**Frontera plataforma/tenant (F5, no reabrir):** la identidad de plataforma es una FILA en
`platform_users` consultada por `auth.uid()` (sin claim JWT, sin `app.es_plataforma()` en
BD — a propósito); el acceso de plataforma a datos de tenant es service_role tras helpers
fail-closed (`autorizarPlataforma`/`autorizarSoporte`). Suspensión = solo lectura vía
políticas RESTRICTIVE por comando de escritura (toda tabla de tenant NUEVA debe añadir las
suyas en su migración). El soporte exige grant NOMINATIVO del cliente, SIN break-glass
(decisión sellada). La purga física es solo por `scripts/purgar-empresa.mjs`: sin acta con
inventario escrita y verificada no hay purga.

**Frontera IA (F6, no reabrir):** la IA solo recibe lo que arma la allow-list
`lib/ia/ia-datos.ts` — agregados YA suprimidos por `agregados.ts` + el catálogo Tabla 4/7,
jamás responses/resultados individuales/registros 5.8/buzón/nombres de empleados. La
llamada sale del servidor tras la interfaz `ProveedorIA` (`@anthropic-ai/sdk` solo en
`lib/ia/proveedor.ts`; guardias de lint bidireccionales). Todo texto vive en `ai_drafts`
append-only con `insumo` + `insumo_sha256` + `prompt_version` + modelo (la terna
reproducible de qué vio la IA); la adopción es un acto del usuario con su sesión (trigger
`app.solo_adopcion`, una sola vía) y la IA JAMÁS escribe en el programa. Un borrador no
adoptado es visualmente inconfundible y no exportable. Flag `ia_asistida` (default OFF) +
limitador de generación **fail-closed** (el límite ES la protección de costo).

**El informe de resultados es del numeral 7.7.** El 7.9 es la PERIODICIDAD bienal: se usa
solo en la alerta de reevaluación y en la conclusión de repetir cada dos años.
`compliance_reports.report_type = 'informe_79'` es un código de tipo interno (evidencia
histórica protegida por CHECK), no el numeral: no se renombra.

### PENDIENTE_CONFIRMAR abiertos

- M2: conteo de preguntas GR-I por sección (6/2/7/5) al cargar textos oficiales.

### Pendientes menores (no bloqueantes, triaje de la revisión final)

- Control de divulgación estadística ENTRE tablas: los totales de distribución son
  inferibles desde los conteos de participación (y entre grupos hermanos); la supresión
  complementaria protege cada tabla en sí. Decisión de producto pendiente si se quiere
  supresión coordinada entre tablas ligadas.
- `flujo.ts` (`gr1_notificacion_dr`) aún inserta a `audit_log` directo (actor sistema,
  fire-and-forget); migrar a `lib/auditoria.ts` por consistencia.
- Seed de demo: primera corrida real verificada (2026-07-12) — ver `docs/demo.md`. Los
  tokens de asignaciones pendientes solo se imprimen en la primera corrida (re-sembrar
  requiere `db reset`).
- Limitador de tasa: RESUELTO post-F5 (wrapper `public.golpe_limite` + spec E2E
  `limites.spec.ts` por la vía REST real). Política de fallo POR ENDPOINT documentada en
  `lib/limites.ts`: fail-closed donde el límite ES la protección (ARCO, buzón,
  `token-miss`); fail-open donde es idempotencia de usuarios ya autorizados.

### Dependencias externas abiertas

- **Validación de lanzamiento del motor pendiente de datos de consultor:** existirán 3–5
  cuestionarios resueltos y validados por un consultor certificado NOM-035 (en gestión, aún no
  disponibles). Se cargarán en `packages/motor-nom035/reference-cases/` (formato JSON
  documentado ahí). Un test marcado `todo` falla en modo "release" si el directorio está
  vacío. Criterio final: coincidencia 100%. Mientras tanto, M1 se cierra "para desarrollo" con
  los casos 1–11 en verde + verificación cruzada manual de 2 casos mixtos contra Evalúa035 de
  CONTPAQi (documentada en `reference-cases/README.md`).

### Orden estricto

No se escribe ni una línea de frontend hasta cerrar el Milestone 1 (motor validado).
Al cerrar cada milestone: detenerse, resumir lo construido, actualizar este archivo y esperar
confirmación antes de continuar.
