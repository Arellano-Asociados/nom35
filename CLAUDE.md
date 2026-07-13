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

### Estructura del monorepo (pnpm workspaces)

```
apps/web/               # Next.js 15 (App Router). E2E Playwright en apps/web/e2e
packages/motor-nom035/  # Motor de cálculo puro (funciones puras, sin I/O, sin framework)
packages/pruebas-rls/   # Suite de aislamiento multi-tenant (gate de CI)
supabase/               # Migraciones SQL, políticas RLS, seeds (Supabase CLI)
.github/workflows/      # CI: lint + typecheck + tests + RLS + E2E como gates
```

### Convenciones de la app web (Milestone 3)

- El enlace del empleado es la CAPACIDAD: hash SHA-256 en BD; cada acción de servidor
  revalida token, vigencia y estado. Todo acceso a datos del flujo del empleado es del
  lado servidor con service_role; las respuestas crudas jamás viajan a un navegador.
- Corregir una respuesta antes de enviar = fila nueva en `responses` (append-only intacto);
  la vigente es la más reciente (`ultimaRespuestaPorItem`).
- Componentes cliente NUNCA dentro de carpetas con corchetes (`[token]`): next start no los
  resuelve (bug del React Client Manifest). Viven en `src/components/`, acciones en
  `src/acciones/`.
- OJO en Windows: no reescribir archivos fuente con Get-Content/Set-Content de PowerShell 5.1
  (lee UTF-8 sin BOM como ANSI y corrompe acentos).
- Correos: jamás incluir datos sensibles; notificaciones genéricas + evento en audit_log
  (actor sistema = uuid cero).

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

### Reglas normativas clave del motor (resumen; detalle en seeds/tablas)

- **GR-III** (72 ítems, centros >50): Grupo A puntúa directo (Siempre=0 … Nunca=4), Grupo B
  inverso (Siempre=4 … Nunca=0). Cfinal: Nulo <50 | Bajo <75 | Medio <99 | Alto <140 |
  Muy alto ≥140. Rangos propios por categoría y por dominio (ver `risk_level_ranges`).
- **GR-II** (46 ítems, centros 16–50): Grupo A = ítems 18–33; Grupo B = 1–17 y 34–46.
  Cfinal: <20/<45/<70/<90/≥90.
- **GR-I** (todas las empresas, Sí/No, sin puntaje): Sección I = exposición a acontecimiento
  traumático severo; si TODAS No → no requiere valoración. Si ALGUNA Sí → secciones II–IV.
  Requiere valoración clínica si: ≥1 Sí en Sección II, o ≥3 Sí en Sección III, o ≥2 Sí en
  Sección IV. Resultado binario + canalización.
- **Ítems condicionales:** GR-III: 65–68 solo si atiende clientes/usuarios; 69–72 solo si
  supervisa personal. GR-II: 41–43 clientes; 44–46 supervisión. Si no aplican, se registran
  como "Nunca" (=0, son Grupo B).
- **Regla de niveles compartida:** puntaje < nulo_max → Nulo; < bajo_max → Bajo;
  < medio_max → Medio; < alto_max → Alto; ≥ alto_max → Muy alto.

## 4. Convenciones

- **Commits atómicos** con mensajes descriptivos **en español**. Una rama por milestone.
- **TDD estricto en el motor** (test primero, luego implementación). Unit + integración en el
  resto; E2E (Playwright) para flujos críticos.
- Migraciones SQL versionadas y reproducibles desde cero; seeds idempotentes.
- Componentes con shadcn/ui; UI íntegramente en **es-MX**, responsive y accesible (labels,
  contraste, navegación por teclado en el cuestionario).
- Lint + typecheck sin warnings. Gates de CI innegociables: lint, typecheck, suite del motor,
  tests de aislamiento multi-tenant.
- TypeScript estricto en todos los paquetes (`tsconfig.base.json`).

### Comandos

```bash
pnpm lint        # ESLint + Prettier check (todo el repo)
pnpm typecheck   # tsc --noEmit en todos los workspaces
pnpm test        # Vitest en todos los workspaces (--if-present)
pnpm exec supabase start   # Supabase local (requiere Docker Desktop)
pnpm exec supabase db reset # Re-aplica migraciones + seeds desde cero
pnpm --filter @nom35/pruebas-rls test:rls # Suite de aislamiento (requiere BD local arriba)
pnpm demo:seed   # Siembra datos de demo (Supabase local arriba; guion en docs/demo.md)
```

Manual de uso completo (guías de Administrador y de empleado, diagramas, tabla de permisos
por rol, FAQ): `docs/manual.md`.

### Convenciones de base de datos

- No hay default privileges: **toda tabla nueva necesita GRANT explícito** por rol
  (mínimo privilegio) además de sus políticas RLS. `responses` no tiene GRANT de SELECT
  para `authenticated` a propósito.
- FKs compuestas `(company_id, id)` en las cadenas de tenant (anti-cruce de empresa).
- El claim `company_id` del JWT lo pone el hook `app.custom_access_token` desde la
  membresía real; las políticas SIEMPRE re-verifican membresía (claim solo no basta).
- La suite de `packages/pruebas-rls` corre en CI con Supabase en Docker; localmente
  requiere Docker Desktop.

## 5. Estado de milestones

| Milestone | Descripción                                                      | Estado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M0        | Init repo, monorepo, CLAUDE.md, CI, Supabase local               | ✅ Cerrado. `supabase start` verificado en local (2026-07-12); `[analytics]` deshabilitado en config.toml — en Windows Logflare exige el daemon de Docker por TCP y tumbaba todo el arranque                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| M1        | Motor de cálculo + suite de validación (antes de cualquier UI)   | 🟡 Cerrado para desarrollo: casos 1–11 verdes, cobertura 100% líneas / 97% ramas. PENDIENTE: captura manual de los 2 casos mixtos en Evalúa035 (tablas listas en `reference-cases/README.md`) y validación de lanzamiento con casos del consultor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| M2        | Base de datos, multi-tenancy y auth (RLS + tests de aislamiento) | ✅ Cerrado: 4 migraciones reproducibles, RLS + grants mínimos en 18 tablas de tenant, triggers de inmutabilidad y nom_category, hook company_id, suite de aislamiento (36 tests) verde como gate de CI. PENDIENTE_CONFIRMAR: conteo de preguntas GR-I por sección (6/2/7/5) al cargar textos oficiales                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| M3        | Flujo del empleado (primera UI) + captura inmutable              | ✅ Cerrado: enlace tokenizado → consentimiento (versión/timestamp/IP) → filtros → cuestionario por secciones con guardado incremental → cálculo síncrono → resultado propio. E2E Playwright verde en las tres guías (condicionales, reconexión, expiración, notificación RD auditada)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| M4        | Panel administrativo                                             | ✅ Cerrado: auth con contraseña (@supabase/ssr) protegiendo `/panel`; alta de empresa/centros (categoría normativa automática) y empleados (alta individual + importación CSV con reporte de errores); ciclos con selección automática de guías y alerta de reevaluación >24 meses (numeral 7.9); distribución con enlaces tokenizados y recordatorios que rotan el token; dashboard agregado (distribuciones/conteos, jamás promedios, supresión n<3); vista GR-I de canalizaciones y acceso individual exclusivos del Responsable Designado con evento `individual_result_access` auditado en cada consulta; sugerencias de acciones (Tabla 7) para niveles medio+; política de prevención (Storage privado + acuse del empleado) y capacitación. E2E Playwright verdes: ciclo completo del Admin de Organización y aislamiento del Consultor entre empresas. PENDIENTE_CONFIRMAR: ninguno nuevo — ver Notas de cierre abajo por dos bugs de CI corregidos durante el cierre.                                                                                                                        |
| M5        | Informe 7.9 y expediente de inspección                           | ✅ Cerrado: informe normativo 7.9 en PDF (@react-pdf/renderer; secciones a–g del numeral: centros, método/guías, distribuciones global/categoría/dominio con supresión n<3 visible como "— (n<3)", resumen GR-I, conclusiones deterministas —Cap. 8 considera niveles de categoría/dominio—, acciones, evaluador, fechas) y expediente de inspección en ZIP (jszip) con manifiesto sha256 por archivo, política de prevención (o marca explícita "ausente"; fallo de descarga aborta, jamás miente), CSVs de proceso —acuses, participación, acciones Tabla 7, capacitación, resumen de auditoría— en UTF-8 con BOM, sin ningún dato de resultados por empleado. Acciones de servidor con autorización de gestión, doble filtro de tenant, INSERT-only a `compliance_reports` y auditoría (`informe_generado`/`expediente_generado`/`informe_descargado`) vía helper compartido `lib/auditoria.ts`. UI en pestaña "Informes y expediente" del ciclo con historial descargable (signed URL 60s, respaldo si el navegador bloquea el popup). Unit tests verdes + E2E `informes.spec.ts`                  |
| M6        | Endurecimiento y demo                                            | ✅ Cerrado: los TRES consumidores de `risk_results` (dashboard, informe 7.9, página de acciones/Tabla 7) filtran resultados vigentes con el mismo criterio compartido (`resultadosVigentesPorAsignacion`, genérico y exportado de `lib/informe.ts`); supresión complementaria en `agregados.ts` (prueba de descomposición única k=1 ∨ S=k ∨ S=2k; sin celda positiva visible se suprime todo el grupo + total; limitación residual de inferencia cruzada documentada); CSVs del expediente neutralizan formula injection (`=`, `+`, `-`, `@`, tab, CR) antes del entrecomillado RFC 4180; acceso individual del RD fail-closed (`registrarAuditoriaEstricta`: sin evento `individual_result_access` registrado no se muestra el resultado); pie del PDF con fecha es-MX; `acuses-politica.csv` identifica título/versión de la política; seed de demo idempotente (`pnpm demo:seed`, resultados vía el motor real, protegido contra targets no locales) + guion en `docs/demo.md`. 51 unit tests web + 59 del motor verdes.                                                                            |
| M7        | Manual de uso y UI premium                                       | ✅ Cerrado: `docs/manual.md` (cómo funciona, diagramas mermaid de flujo y secuencia validados, guía del Administrador con formato CSV y tabla de permisos por rol derivada del código, guía del empleado, prueba end-to-end local y FAQ) + rediseño visual completo sin tocar lógica: Inter vía next/font, tokens de foco/contraste, shell del panel con sidebar (drawer móvil accesible), grupo de rutas `(centrado)` para el flujo del empleado, toasts (sonner) aditivos a los alerts inline, tablas/badges de nivel AA/estados vacíos/tiles del dashboard, flujo del empleado con cards Likert (touch ≥44px), progreso pegajoso y resultado con jerarquía. Enlace "Acceso administrativo" en la raíz. E2E 10/10 verificados localmente en cada tarea de UI.                                                                                                                                                                                                                                                                                                                                        |
| F1.5      | Remediación de críticos de la auditoría v0 (`docs/AUDITORIA.md`) | ✅ Cerrado (2026-07-13): corrección normativa GR-II 18–19 (motor 0.2.0; recálculo 0.1.0 verificado NO aplicable), textos oficiales de los 138 ítems con gate de CI, supresión de fila completa anti-reidentificación, expiración del token antes que "completado" + consulta auditada, guardas de escritura (`lib/escrituras.ts`), confirmación de correo obligatoria + contraseñas 12+, aviso de privacidad versionado en BD + canal ARCO público, CSP con nonce/HSTS/XFO, catálogo tipado de `event_type`, errores de formulario visibles + `error.tsx`/`not-found.tsx`, validación de subidas por magic bytes, diálogo de confirmación accesible con conteo de correos, foco visible + contrastes AA. Mapa hallazgo→commit y deuda abierta reconocida en `docs/AUDITORIA.md`. Validación: motor 59/59, web 59/59, RLS 38/38, E2E 10/10, 12 migraciones desde cero.                                                                                                                                                                                                                                  |
| F2        | Sistema de diseño e identidad **Constata**                       | ✅ Cerrado (2026-07-13): marca Constata (elección del propietario; manual en `docs/BRAND.md`) con logotipo/isotipo/favicon propios y `title.template`; design tokens en `@theme` (marca azul profundo, semáforo por nivel con AA, semánticos de interfaz; cero paleta cruda en componentes); librería UI (Button con `cargando`, CampoTexto/CampoSelect con error ligado, TablaDatos con búsqueda/orden/paginación, Modal base del DialogoConfirmacion, EmptyState con contrato qué/por qué/CTA, Tabs, Breadcrumbs, Skeleton); login dividido con propuesta de valor; navegación (empresa activa + selector multi-tenant, pestañas del ciclo en layout compartido, migas, footer legal, checklist de primer uso); copy es-MX de las 25 filas de la auditoría (parcial: plantilla CSV descargable); correos con `plantillaCorreo` (escape de HTML, `MAIL_FROM` obligatorio en producción); a11y: drawer con foco gestionado, skip link, guardado anunciado, scroll-padding. Mapa hallazgo→commit en `docs/AUDITORIA.md` (Remediación Fase 2). Validación: motor 59/59, web 66/66, RLS 38/38, E2E 10/10. |

### Notas de cierre de M4 (para no repetir la investigación)

- El hook `app.custom_access_token` corre como `supabase_auth_admin`. El `GRANT EXECUTE`
  sobre la función (migración de M2) no basta: sin `GRANT USAGE ON SCHEMA app TO
supabase_auth_admin` (migración `20260711230000_grant_hook_auth.sql`), GoTrue no puede
  siquiera resolver la función y **todo** signup/login con contraseña falla con 500. El
  flujo del empleado no pasa por GoTrue y la suite RLS corre sin servicio de auth, así que
  nada lo había ejercitado hasta el primer E2E del panel.
- `locator.count()` de Playwright **no espera** — lee el DOM en el instante exacto en que se
  llama. Tras un clic que dispara una transición cliente (nueva sección del cuestionario,
  montaje inicial tras "Comenzar cuestionario"), hay que esperar una señal explícita (texto,
  testid) de que el nuevo contenido ya montó antes de volver a contar/clicar; si no, se
  cuenta la sección vieja y se responde de menos, dejando el cuestionario permanentemente
  incompleto. Ver `apps/web/e2e/utilidades.ts`.

### Pendientes menores post-M6 (no bloqueantes, triaje de la revisión final)

- Control de divulgación estadística ENTRE tablas: los totales de distribución son
  inferibles desde los conteos de participación (y entre grupos hermanos); la supresión
  complementaria protege cada tabla en sí. Decisión de producto pendiente si se quiere
  supresión coordinada entre tablas ligadas.
- `flujo.ts` (`gr1_notificacion_dr`) aún inserta a `audit_log` directo (actor sistema,
  fire-and-forget); migrar a `lib/auditoria.ts` por consistencia.
- Seed de demo: primera corrida real verificada (2026-07-12) — ver `docs/demo.md`. Los
  tokens de asignaciones pendientes solo se imprimen en la primera corrida (re-sembrar
  requiere `db reset`).

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
