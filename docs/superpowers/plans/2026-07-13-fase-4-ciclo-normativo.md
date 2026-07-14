# Fase 4 — Ciclo normativo completo: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Difusión de resultados a los trabajadores (5.7 e/7.8), buzón confidencial de quejas (8.1 b), Programa de intervención (8.3/8.4/8.5) y expediente ZIP con todas las piezas del ciclo e índice legible.

**Architecture:** Tres subsistemas nuevos sobre patrones ya probados — instantánea agregada sellada (patrón `compliance_reports` + `agregados.ts`), canal por token de empresa con folio (patrón `token_hash` + `arco_requests` + limitador), documento Programa sobre `action_items` extendida — y una ampliación del módulo puro `expediente.ts`. Spec: `docs/superpowers/specs/2026-07-13-fase-4-ciclo-normativo-design.md`.

**Tech Stack:** El existente (Next.js 15, Supabase, @react-pdf/renderer, jszip, Vitest, Playwright). Sin dependencias nuevas.

## Global Constraints

- Reglas inviolables de CLAUDE.md §3: append-only donde sea evidencia; sin promedios; supresión n<3 con enmascarado de fila completa; respuestas crudas jamás patronales; tenancy por membresía; nada normativo hardcodeado (textos de la Tabla 4/7 → `system_config`); logs limpios.
- El contenido de una queja tiene el estándar de los resultados individuales: sin GRANT a `authenticated`, lectura solo vía app con `registrarAuditoriaEstricta` (fail-closed), jamás en correos ni logs.
- Texto libre del trabajador: render SIEMPRE como texto JSX (nunca `dangerouslySetInnerHTML`); en correos siempre `plantillaCorreo` (escapa).
- Toda tabla nueva: RLS + GRANT explícito mínimo + FK compuesta `(company_id, id)` + test en `packages/pruebas-rls`. Todo `event_type` nuevo entra al union `EVENTOS_AUDITORIA`. Página nueva del panel con service_role → allowlist de `eslint.config.mjs`.
- TDD en lógica pura; lint + typecheck sin warnings; commits atómicos en español; push conforme avances.
- Windows: no reescribir fuentes con Get-Content/Set-Content (PowerShell 5.1). Componentes cliente jamás dentro de carpetas `[token]`.
- Sin Docker local: RLS y E2E se validan en CI; unit/lint/typecheck localmente.
- No cambiar `data-testid` existentes.

---

### Task 1: Migración de difusión + tests RLS

**Files:**
- Create: `supabase/migrations/20260713180000_difusion_resultados.sql`
- Modify: `packages/pruebas-rls/src/aislamiento.test.ts` (+ fixtures si aplica)

**Interfaces (produce):** tablas `dissemination_records` (`id`, `company_id`, `cycle_id`, `version int` — `unique (cycle_id, version)` —, `summary jsonb`, `sha256 text`, `published_by uuid`, `published_at timestamptz default now()`; FK compuesta `(company_id, cycle_id)` a `compliance_cycles`; **append-only** con `app.rechazar_modificacion`; RLS select miembro / insert gestión; GRANT select+insert a `authenticated`, all a `service_role`) y `dissemination_receipts` (`id`, `company_id`, `dissemination_id`, `employee_id`, `acknowledged_at default now()`; `unique (dissemination_id, employee_id)`; FKs compuestas; append-only; RLS select gestión; GRANT select a `authenticated`; insert solo `service_role` — flujo del empleado).

- [ ] Escribir la migración siguiendo el patrón de `feature_flags`/`policy_acknowledgments` (RLS, GRANTs, triggers, FKs compuestas — los padres ya declaran `unique (company_id, id)`).
- [ ] Tests RLS nuevos: aislamiento entre tenants de ambas tablas; `esperarRechazo` de UPDATE/DELETE (append-only); insert de receipt negado a `authenticated`.
- [ ] Commit: `Difusión de resultados: tablas selladas append-only (dissemination_records/receipts) con RLS`.

### Task 2: Instantánea de difusión (lógica pura, TDD)

**Files:**
- Create: `apps/web/src/lib/difusion.ts` + `apps/web/src/lib/difusion.test.ts`

**Interfaces (produce):**
- `armarResumenDifusion(entrada): ResumenDifusion` — entrada: filas vigentes de `risk_results` (reutiliza `resultadosVigentesPorAsignacion` de `lib/informe.ts`), resumen GR-I, participación por centro, conteo de acciones del programa, nombre de empresa/ciclo/fechas, y `urlBuzon?: string`. Salida (`summary` a persistir): distribución global + por categoría vía `distribucionNiveles`/`distribucionPorNombre` (supresión y enmascarado de fila completa YA aplicados), párrafos en lenguaje llano (sin jerga GR-x: "Cuestionario sobre tu entorno de trabajo"), nota fija "los resultados son distribuciones de grupo; nadie puede ver tus respuestas individuales".
- `sellarResumen(resumen): { json: string; sha256: string }` — serialización **canónica** (claves ordenadas recursivamente) + sha256 hex; determinista para el mismo contenido.

- [ ] Tests que fallan: (a) con 1 solo respondiente la distribución sale enmascarada COMPLETA (fila + total) — nada individual sobrevive en el resumen; (b) el sha256 es estable ante reordenamiento de claves de entrada; (c) el texto llano no contiene "GR-III"/"Cfinal"; (d) con `urlBuzon` presente, el resumen la incluye.
- [ ] Implementar; tests verdes.
- [ ] Commit: `Difusión: instantánea agregada con supresión y sellado sha256 canónico (TDD)`.

### Task 3: Difusión — panel y flujo del empleado

**Files:**
- Create: `apps/web/src/app/panel/[empresa]/ciclos/[ciclo]/difusion/page.tsx`
- Create: `apps/web/src/components/panel/publicar-difusion.tsx` (cliente: confirmación + toast)
- Create: `apps/web/src/components/responder/difusion.tsx` (render del summary + botón de acuse)
- Modify: `apps/web/src/acciones/informes.ts` (o `acciones/difusion.ts` nuevo): `accionPublicarDifusion(companyId, cicloId)`
- Modify: `apps/web/src/acciones/responder.ts`: `accionAcusarDifusion(token, disseminationId)`
- Modify: `apps/web/src/lib/flujo.ts`: `difusionVigenteDe(ctx)` (última versión publicada del ciclo)
- Modify: `apps/web/src/app/(centrado)/responder/[token]/page.tsx` (sección "Resultados generales" en estados no expirados)
- Modify: `apps/web/src/app/panel/[empresa]/ciclos/[ciclo]/layout.tsx` (pestaña "Difusión")
- Modify: `apps/web/src/lib/auditoria.ts` (+`difusion_publicada`, `difusion_acusada`)
- Modify: `eslint.config.mjs` (allowlist: `difusion/page.tsx` agrega resultados como el dashboard)

**Comportamiento:**
- Panel: vista previa de la instantánea (mismos datos vigentes que el dashboard), publicar con `DialogoConfirmacion` → `accionPublicarDifusion` (autoriza gestión, limitador `difusion:<cicloId>` 1/5 min, arma+sella con Task 2, INSERT append-only versión = max+1, audita `difusion_publicada` con sha256 en details). Historial de versiones con fecha/hash/conteo de acuses.
- Empleado: si hay difusión publicada y el enlace no expiró, `/responder/[token]` muestra `<Difusion>` (también tras completar); acusar → `accionAcusarDifusion` (guardas de token + limitador `token:` existentes; upsert-idempotente sobre el `unique`; audita `difusion_acusada` actor sistema). El acuse NO exige haber completado el cuestionario.
- [ ] Implementar; lint/typecheck verdes; unit test de `difusionVigenteDe` si la lógica no es trivial.
- [ ] Commit: `Difusión: publicación sellada por ciclo, consulta y acuse desde el enlace del trabajador`.

### Task 4: Migración del buzón + tests RLS

**Files:**
- Create: `supabase/migrations/20260713190000_buzon_quejas.sql`
- Modify: `packages/pruebas-rls/src/aislamiento.test.ts`

**Interfaces (produce):**
- `complaint_boxes` — `company_id uuid` PK/FK, `token_hash text not null unique`, `rotated_at timestamptz default now()`. RLS select gestión; GRANT select a `authenticated`; escritura solo `service_role`.
- `complaints` — `id`, `company_id`, `folio text unique not null`, `folio_key_hash text not null`, `category text check in ('violencia_laboral','practicas_opuestas_eof')`, `body text not null`, `is_identified boolean not null default false`, `contact_name text`, `contact_info text`, `status text not null default 'recibida' check in ('recibida','en_revision','atendida','cerrada')`, `created_at`. Trigger `app.queja_solo_estado()` (patrón `gr1_solo_canalizacion`): UPDATE solo si únicamente cambia `status`; DELETE/TRUNCATE rechazados. **SIN GRANT para `authenticated`** (ni select): solo `service_role`.
- `complaint_events` — `id`, `company_id`, `complaint_id` (FK compuesta), `from_status`, `to_status`, `note text not null`, `actor_user_id uuid not null`, `created_at`. Append-only. Sin GRANT a `authenticated` (se lee vía app junto con la queja).

- [ ] Migración con el patrón de tenant; índice por `(company_id, status)`.
- [ ] Tests RLS: `authenticated` de otro tenant Y del propio no puede SELECT/INSERT/UPDATE `complaints` (sin GRANT, 42501); `esperarRechazo` de UPDATE de `body` y DELETE como postgres (trigger); append-only de `complaint_events`.
- [ ] Commit: `Buzón de quejas: tablas confidenciales sin GRANT patronal, estado como único campo mutable`.

### Task 5: Folio y clave (lógica pura, TDD) + flujo del trabajador

**Files:**
- Create: `apps/web/src/lib/buzon.ts` + `apps/web/src/lib/buzon.test.ts`
- Create: `apps/web/src/acciones/buzon.ts` (`'use server'`)
- Create: `apps/web/src/app/(centrado)/buzon/[token]/page.tsx`
- Create: `apps/web/src/components/buzon/formulario-queja.tsx` y `consulta-folio.tsx` (cliente, fuera de `[token]`)
- Modify: `apps/web/src/app/(centrado)/responder/[token]/page.tsx` (+ enlace al buzón de la empresa en todos los estados no-inválidos)
- Modify: `apps/web/src/lib/flujo.ts` (`urlBuzonDe(companyId)`: asegura `complaint_boxes` y devuelve URL con token en claro solo al crearla — ver nota)
- Modify: `apps/web/src/lib/auditoria.ts` (+`queja_recibida`)

**Interfaces (produce):**
- `generarFolio(): string` — `QJ-` + 8 caracteres de alfabeto sin ambigüedad (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`) desde `crypto.randomBytes`.
- `generarClave(): string` — 12 caracteres del mismo alfabeto; `hashDeClave(clave)` = sha256 hex (reutiliza `hashDeToken`).
- `contextoBuzon(token)`: resuelve `complaint_boxes` por `token_hash` → `{ companyId, razonSocial }`; token inválido consume `token-miss:<ip>`.
- `accionEnviarQueja(token, datos)`: valida categoría/longitud (body 20–5000 chars), identidad EXPLÍCITA (`anonimo: boolean`; si identificado, `contact_name` obligatorio), limitador `buzon:<ip>` 5/hora, INSERT service_role, correo genérico a admins/RD (plantillaCorreo, SIN contenido), `queja_recibida` (actor sistema, details solo folio+categoría), devuelve `{folio, clave}` UNA sola vez.
- `accionConsultarFolio(token, folio, clave)`: limitador `buzon-folio:<ip>` 30/10 min; compara `folio_key_hash`; devuelve SOLO `{status, createdAt, transiciones: [{toStatus, at}]}` — jamás el contenido.

**Nota token del buzón:** el token en claro no se puede re-derivar del hash. `complaint_boxes` se crea desde el panel (Task 6) que muestra la URL al crearla/rotarla; para el enlace en `/responder/[token]` la página del panel es la fuente (el flujo del empleado enlaza vía URL absoluta guardada… NO: no guardar el token en claro). Resolución: el enlace del buzón para el empleado se INCLUYE en el `summary` de la difusión (el panel lo pega al publicar, campo `urlBuzon` de Task 2) y en los correos de invitación/recordatorio como línea fija opcional si la empresa ya activó su buzón — se pasa el token en claro SOLO en el momento del envío del correo, leyéndolo de una columna… **Decisión final: `complaint_boxes` guarda ADEMÁS `token text` en claro** (a diferencia de los tokens de asignación, este enlace es DE DIFUSIÓN OBLIGATORIA — 5.7 d — no una capacidad secreta personal; su secreto no protege datos, solo evita spam, y el limitador cubre eso). Sin GRANT de select a `authenticated` sobre la columna no hace falta: select de gestión está bien.
- [ ] Tests TDD de `generarFolio`/`generarClave`/validaciones de `accionEnviarQueja` (longitud, identidad explícita, categoría inválida).
- [ ] Implementar página con las dos pestañas (enviar / consultar folio) accesibles sin sesión, es-MX, con el folio+clave mostrados una única vez tras enviar.
- [ ] Commit: `Buzón: envío anónimo u identificado con folio+clave y consulta de estado sin sesión (TDD)`.

### Task 6: Buzón — panel (lectura auditada fail-closed y seguimiento)

**Files:**
- Create: `apps/web/src/app/panel/[empresa]/buzon/page.tsx` (lista sin contenido) y `buzon/[queja]/page.tsx` (detalle auditado)
- Create: `apps/web/src/components/panel/queja-detalle.tsx` (cliente: cambio de estado con nota)
- Modify: `apps/web/src/acciones/buzon.ts`: `accionCrearORotarEnlaceBuzon(companyId)`, `accionActualizarQueja(companyId, quejaId, nuevoEstado, nota)`
- Modify: `apps/web/src/components/panel/sidebar.tsx` (sección "Buzón")
- Modify: `apps/web/src/lib/auditoria.ts` (+`queja_consultada`, `queja_actualizada`, `buzon_enlace_rotado`)
- Modify: `eslint.config.mjs` (allowlist: `buzon/page.tsx`, `buzon/[queja]/page.tsx` — `complaints` no tiene GRANT)

**Comportamiento:**
- Lista (admin_org/consultor/RD): folio, categoría (etiqueta llana), estado (badge), fecha, identificada sí/no — SIN contenido. Bloque "Enlace del buzón": crear/rotar con confirmación (rotar invalida el anterior; audita `buzon_enlace_rotado`), URL copiable + recordatorio de difundirlo (5.7 d).
- Detalle: ANTES de renderizar contenido, `registrarAuditoriaEstricta('queja_consultada', entityId=queja)` — si falla, error es-MX y NADA se muestra (patrón página individual del RD). Contenido como texto plano. Cambio de estado exige nota → `complaint_events` + `queja_actualizada`.
- [ ] Implementar; verificación de rol: `puedeGestionar(membresia) || membresia.esResponsableDesignado`.
- [ ] Commit: `Buzón: panel con lectura auditada fail-closed, seguimiento por estados y rotación del enlace`.

### Task 7: Migración del programa + criterios Tabla 4/7 + tests RLS

**Files:**
- Create: `supabase/migrations/20260713200000_programa_intervencion.sql`
- Modify: `packages/pruebas-rls/src/aislamiento.test.ts`

**Interfaces (produce):**
- `intervention_programs` — `id`, `company_id`, `cycle_id` (`unique (company_id, cycle_id)`), `scope_areas text not null`, `responsible text not null`, `post_evaluation text`, `post_evaluation_date date`, `created_by uuid`, `created_at`, `updated_at`. RLS select miembro / insert+update gestión (sin delete). GRANT select/insert/update a `authenticated`.
- `action_items` + columnas: `program_id uuid`, FK compuesta `(company_id, program_id) → intervention_programs (company_id, id)`, `target_areas text`, `action_level text check in ('primer_nivel','segundo_nivel','tercer_nivel')`, `evidence_path text`, `evidence_sha256 text`, `completed_at timestamptz` (todas nullable — filas viejas válidas).
- Seed `system_config` key `criterios_toma_acciones`: JSON con, por nivel (`muy_alto`→`nulo`), el texto LITERAL de la Tabla 4/7 del DOF ("Criterios para la toma de acciones", idéntica en Guías II y III) y `accionesSugeridas` (descripcion, action_level) derivadas: muy_alto → evaluación específica (obligatoria) + campaña de sensibilización + revisión de política/programas; alto → campaña + revisión (evaluación específica opcional); medio → revisión y refuerzo de aplicación/difusión de política y programas. Bucket privado `evidencias`.
- [ ] Migración + seed idempotente (`on conflict (key) do update`) + bucket.
- [ ] Tests RLS: aislamiento de `intervention_programs`; update permitido a gestión del tenant y negado cruzado.
- [ ] Commit: `Programa de intervención: tabla 8.4, extensión de action_items y criterios literales de la Tabla 4/7 como datos`.

### Task 8: Programa — pre-población (TDD) y página

**Files:**
- Create: `apps/web/src/lib/programa.ts` + `apps/web/src/lib/programa.test.ts`
- Modify: `apps/web/src/app/panel/[empresa]/ciclos/[ciclo]/acciones/page.tsx` → título/copy "Programa de intervención (Capítulo 8)"; integra creación del programa y lo existente
- Create: `apps/web/src/components/panel/crear-programa.tsx`, `accion-avance.tsx` (cliente)
- Modify: `apps/web/src/acciones/panel.ts` (o `acciones/programa.ts` nuevo): `accionCrearPrograma`, `accionActualizarPrograma`, `accionSubirEvidenciaAccion`, extensión de `accionCrearAccion`/`accionActualizarAccion` con los campos nuevos
- Modify: `apps/web/src/lib/auditoria.ts` (+`programa_creado`, `programa_actualizado`, `evidencia_accion_subida`)
- Modify: `apps/web/src/app/panel/[empresa]/ciclos/[ciclo]/layout.tsx` (renombrar pestaña a "Programa de intervención")

**Interfaces (produce):**
- `nivelesQueExigenPrograma(niveles: NivelRiesgo[]): boolean` y `accionesPrePobladas(nivelesDetectados, criterios): AccionSugerida[]` en `lib/programa.ts` — puras; medio/alto/muy_alto exigen programa (Tabla 4/7); las acciones sugeridas se toman de `criterios_toma_acciones` SIN duplicar textos en código, dedupe por descripción quedándose con la del nivel más alto.
- `accionSubirEvidenciaAccion`: acepta PDF (`validarPdf`) o imagen (`validarImagen`), sube a `evidencias` con `rutaDeObjeto`, guarda `evidence_path`+`evidence_sha256` (sha256 de los bytes), audita.
- [ ] Tests TDD de `nivelesQueExigenPrograma` (bajo/nulo no exigen) y `accionesPrePobladas` (dedupe, niveles combinados, criterios vacíos → lista vacía sin crash).
- [ ] Página: si hay niveles medio+ vigentes (mismo cálculo que ya hace la página con `resultadosVigentesPorAsignacion`) y no hay programa → banner normativo + formulario 8.4 con acciones pre-pobladas editables; con programa → encabezado con los 6 incisos, avance (n de m completadas), acciones con evidencia/estado/completed_at.
- [ ] Commit: `Programa de intervención: creación guiada con acciones pre-pobladas de la Tabla 4/7, avance y evidencia por acción (TDD)`.

### Task 9: Expediente ZIP completo (TDD) + PDF del programa

**Files:**
- Modify: `apps/web/src/informes/expediente.ts` + `expediente.test.ts`
- Create: `apps/web/src/informes/programa-pdf.tsx`
- Modify: `apps/web/src/acciones/informes.ts` (`accionGenerarExpediente` reúne las piezas nuevas; render del PDF del programa)

**Interfaces (produce):** `EntradaExpediente` gana campos opcionales: `difusion?: {version, sha256, publicadaEl, resumenJson: string, acuses: {empleado, version, fecha}[]}`, `programa?: {pdf: Buffer, avances: {descripcion, nivelAccion, areas, responsable, fechaCompromiso, estatus, fechaCompletado, evidenciaSha256}[]}`, `buzonAgregado?: {categoria, estatus, mes, conteo}[]`, `cuestionariosAplicados: {guia, sellosha256, itemsJson: string}[]`. `armarExpediente` produce además: `INDICE.txt` (PRIMERA entrada: descripción de una línea + sha256 por archivo, es-MX, marca "ausente" para piezas faltantes), `cuestionarios-aplicados.json`, `constancia-difusion.json` + `acuses-difusion.csv`, `programa-intervencion.pdf` + `programa-avances.csv`, `buzon-registro.csv`.

- [ ] Tests que fallan primero: INDICE.txt es la primera entrada y lista TODOS los archivos con sha256 coincidente con el manifiesto; piezas ausentes aparecen como "ausente" en índice y manifiesto; `buzon-registro.csv` solo trae conteos (cabecera exacta `categoria,estatus,mes,conteo`); `programa-avances.csv` sin datos de resultados individuales; CSVs nuevos pasan por `construirCsv`.
- [ ] `programa-pdf.tsx`: documento con los 6 incisos del 8.4 (áreas sujetas, acciones+niveles 8.5, fechas, avance, evaluación posterior, responsable) + pie con fecha es-MX y sha256, mismo estilo del informe.
- [ ] `accionGenerarExpediente`: consulta difusión vigente + receipts, programa + acciones, agregado de quejas (`select category, status, date_trunc('month', created_at)` con service_role — conteos, jamás contenido), textos de `questions` por guía del ciclo (sellados con sha256 del JSON canónico de Task 2).
- [ ] Commit: `Expediente completo: índice legible, instrumentos sellados, constancia de difusión, programa con avances y registro agregado del buzón (TDD)`.

### Task 10: E2E del ciclo normativo

**Files:**
- Create: `apps/web/e2e/ciclo-normativo.spec.ts`
- Modify: `apps/web/e2e/global-setup.ts` SOLO si hace falta exponer datos extra en `.datos-e2e.json`

**Flujos (patrón de `informes.spec.ts`/`cuestionarios.spec.ts`, testids con prefijo nuevo `cn-`):**
1. Difusión: login admin → ciclo con resultados → pestaña Difusión → publicar (confirmación) → aparece versión con hash; abrir token de empleado completado → ver "Resultados generales" → acusar → panel muestra 1 acuse.
2. Buzón: panel → Buzón → crear enlace → abrir `/buzon/<token>` sin sesión → enviar queja anónima → capturar folio+clave → consultar folio (estado "recibida") → panel: detalle (contenido visible) → cambiar estado con nota → consulta de folio refleja "en revisión"; verificar en BD (helper `pg`) el evento `queja_consultada`.
3. Programa: pestaña Programa de intervención → crear pre-poblado → completar una acción → avance visible.
- [ ] Escribir el spec; verificar que no rompe los 11 existentes (los testids y rutas previos no cambian; la pestaña "Acciones correctivas" renombrada → grep en specs previos por su texto).
- [ ] Commit: `E2E: difusión con acuse, buzón anónimo con folio y seguimiento, programa pre-poblado`.

### Task 11: Cierre — docs, validación, PR, merge, tag

- [ ] `apps/web/package.json` → `0.5.0`.
- [ ] `docs/manual.md`: secciones nuevas (difusión, buzón — guía del trabajador y del admin —, programa de intervención, contenido del expediente); tabla de permisos actualizada (quejas: gestión+RD, auditado).
- [ ] `docs/AUDITORIA.md`: sección "Remediación — Fase 4 «ciclo normativo»" con mapa hallazgo→commit (difusión 5.7 e/7.8, buzón 8.1 b, programa 8.3/8.4, registro del buzón; anotar deuda que sigue: renombrar informe a 7.7 + incisos b/c, registro 5.8 c exportable, ATS fuera de ciclo, registro completo 5.8 a).
- [ ] CLAUDE.md: fila F4 en milestones con resumen de cierre; convenciones nuevas si las hubo.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` verdes; push; PR `fase-4-ciclo-normativo` → `main` con descripción por entregable; esperar CI verde; merge; `git tag v0.5-ciclo-completo` + push del tag.
- [ ] Commit: `Cierre documental de la Fase 4: mapa entregable→commit y versión 0.5.0`.

## Self-Review

- Cobertura del spec: difusión (Tasks 1–3), buzón (4–6), programa (7–8), expediente (9), transversales de auditoría/limitador/ESLint dentro de cada task, E2E (10), docs/tag (11). La deuda "informe 7.7" queda explícitamente fuera y documentada (decisión del spec).
- Decisión tomada en Task 5 (token del buzón en claro en BD) documentada con su porqué: es un enlace de difusión obligatoria, no una capacidad secreta personal.
- Tipos consistentes: `ResumenDifusion`/`sellarResumen` (Task 2) los consume Task 3 y Task 9 (sellado de instrumentos); `EntradaExpediente` ampliada solo con opcionales para no romper tests existentes.
