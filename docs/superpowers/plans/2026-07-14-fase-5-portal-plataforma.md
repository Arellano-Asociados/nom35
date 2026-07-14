# Fase 5 — Portal super-admin de plataforma: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** operar la plataforma desde `/admin` (organizaciones con estados
activa/suspendida/baja, feature flags con bitácora, vista de soporte solo-lectura con
consentimiento nominativo, métricas operativas) sin abrir la frontera plataforma/tenant.

**Architecture:** identidad de plataforma = fila real en `platform_users` por `auth.uid()`
(sin claim JWT, sin `app.es_plataforma()`); acceso a datos de tenant = service_role tras
helpers fail-closed; suspensión BD-primero inyectando `app.tenant_activo()` DENTRO de
`gestiona_tenant`/`es_admin_org`; bitácora de plataforma separada y append-only; grants de
soporte NOMINATIVOS creados por el cliente vía RLS, SIN break-glass. Spec (leer COMPLETO
antes de empezar, incluye las 7 decisiones selladas y el modelo de amenazas):
`docs/superpowers/specs/2026-07-14-fase-5-portal-plataforma-design.md`.

**Tech Stack:** el existente. Sin dependencias nuevas.

## Global Constraints

- Reglas inviolables CLAUDE.md §3 — las reglas 4 y 5 aplican AL OPERADOR de plataforma: la
  vista de soporte jamás muestra respuestas, resultados individuales, registros 5.8 ni
  contenido de quejas; las métricas jamás derivan de salud, ni con supresión n<3.
- Decisión sellada 5c: **SIN break-glass.** Si ningún admin del cliente puede otorgar el
  grant, soporte no entra. No implementar caminos de excepción "temporales".
- Toda tabla nueva: RLS + GRANT explícito + tests. Eventos nuevos a los catálogos cerrados
  (`EVENTOS_AUDITORIA` tenant / `EVENTOS_PLATAFORMA`). TDD en lógica pura. Commits atómicos
  en español; push conforme avances. Tras cada commit solo los tests del módulo tocado; las
  suites completas al cierre.
- La suite RLS es gate de CI: cada migración aterriza CON sus tests en el mismo commit.

### Task 1: Migración de identidad de plataforma + bitácora + tests RLS

- Create: `supabase/migrations/20260714200000_plataforma_identidad.sql`
- Modify: `packages/pruebas-rls/src/{fixtures.sql,aislamiento.test.ts}`
- [ ] `platform_users` ampliada (status invited/active/disabled, display_name, invited_by,
      activated_at, disabled_at); trigger `app.rechazar_identidad_dual()` (BEFORE INSERT en
      role_assignments/employees/consultant_assignments y en platform_users);
      `platform_audit_log` (RLS sin políticas ni GRANTs para authenticated; append-only con
      `app.rechazar_modificacion`).
- [ ] Fixture: usuario "operador" activo sin membresías. Tests: escalada admin_org →
      platform_users (INSERT/UPDATE/DELETE 42501); SELECT platform_users = solo fila propia
      (0 filas para tenant); platform_audit_log ilegible/inescribible para authenticated;
      identidad dual rechazada en ambas direcciones; operador sin membresías no lee
      companies/employees/responses.
- [ ] Commit.

### Task 2: Migración de estados de organización + tests RLS de suspensión

- Create: `supabase/migrations/20260714210000_companies_status.sql`
- Modify: `packages/pruebas-rls/src/{fixtures.sql,aislamiento.test.ts}`
- [ ] `companies.status` (active/suspended/pending_deletion) + status_changed_at +
      suspension_reason + deletion_requested_at; `app.tenant_activo()`; `create or replace`
      de `app.gestiona_tenant` y `app.es_admin_org` con `and app.tenant_activo(cid)`.
      ANTES: grep de TODAS las políticas de escritura — la que use `es_mi_tenant` a secas
      se recrea individualmente. Decidir y documentar la excepción del RD (canalizaciones
      `gr1_results` sobreviven a la suspensión: atención a la salud, no operación).
- [ ] Fixture: tenant C suspendido con admin propio. Tests: escrituras del admin de C →
      42501; lecturas OK (solo lectura); UPDATE de `companies.status` como admin_org →
      42501; los tests existentes de A/B sin regresión.
- [ ] Commit.

### Task 3: Identidad end-to-end de `/admin` (autorización, MFA forzado, frescura, bootstrap)

- Create: `apps/web/src/lib/autorizacion-plataforma.ts` (`autorizarPlataforma`,
  `VENTANA_TOTP_ADMIN_MS = 4h`), `apps/web/src/lib/auditoria-plataforma.ts` (catálogo
  `EVENTOS_PLATAFORMA` + variantes normal/estricta), `scripts/crear-operador.mjs`,
  `app/admin/layout.tsx`, `app/admin/{ingresar,activar}/page.tsx`,
  `app/admin/mfa/{enrolar,verificar}/page.tsx`, componentes cliente TOTP en
  `src/components/admin/` (trampa de corchetes).
- [ ] Sin factor TOTP → bloqueo en enrolar (no degradación aal1); `currentLevel !== aal2` →
      verificar; timestamp TOTP del AMR > 4h → re-verificar. Toda página/acción llama
      `autorizarPlataforma()` primera línea. Operador no-active → redirect a `/ingresar`
      sin revelar que `/admin` existe.
- [ ] `/admin/operadores`: invitar (inviteUserByEmail + status invited + evento),
      deshabilitar (signOut + evento; prohibido si es el último activo). Unit tests de la
      lógica pura extraíble (ventana AMR, transiciones de estado de operador).
- [ ] Commit.

### Task 4: Gestión de organizaciones (alta operada, suspensión/reactivación, enforcement app)

- Create: `apps/web/src/acciones/plataforma.ts`, `app/admin/organizaciones/page.tsx` +
  `organizaciones/[companyId]/page.tsx`.
- Modify: `lib/autorizacion.ts` (+`empresaStatus` en el retorno), layout del panel (banner
  de suspensión con el copy de §2.4 del spec), helper de validación de token del flujo del
  empleado (+check `status='active'` → página "no disponible temporalmente" SIN registrar
  respuesta), `app/api/cron/recordatorios/route.ts` y `lib/recordatorios.ts` (filtro
  `status='active'`), `lib/auditoria.ts` (+`empresa_suspendida`, `empresa_reactivada`,
  `empresa_baja_solicitada`, `empresa_creada` ya existe).
- [ ] Transiciones con doble bitácora (plataforma estricta + tenant fire-and-forget); alta
      operada = companies + inviteUserByEmail + role_assignments; descargas de informes
      existentes PERMITIDAS en suspensión (decisión 2 — verificar que la signed URL no pasa
      por una escritura).
- [ ] Commit.

### Task 5: Feature flags desde UI + bitácora de plataforma legible

- Create: `app/admin/bitacora/page.tsx`.
- Modify: `acciones/plataforma.ts` (+`accionActualizarFlag`: estricta en plataforma +
  fire-and-forget en tenant con valor anterior→nuevo), ficha de organización (toggles de
  `FLAGS`), `lib/auditoria.ts` (+`flag_actualizado`).
- [ ] `/admin/bitacora` filtrable por operador/empresa/evento (service_role tras
      `autorizarPlataforma()`, paginada — no traer la tabla entera a memoria).
- [ ] Commit.

### Task 6: Grants de soporte nominativos + lado cliente (deep link) + tests RLS

- Create: `supabase/migrations/20260714220000_support_access_grants.sql` (DDL de §6.2 del
  spec CON `operator_user_id` FK a platform_users — decisión 5a — y `operator_email`
  desnormalizado; trigger `app.solo_revocacion`), `app/panel/[empresa]/soporte/page.tsx`,
  `apps/web/src/acciones/soporte-tenant.ts` (otorgar con sesión del cliente vía RLS,
  revocar), componente de aviso de grant vigente en el layout del panel.
- Modify: `acciones/plataforma.ts` (+`accionSolicitarAcceso`: evento
  `soporte_acceso_solicitado` + correo a los admin_org con deep link
  `?operador=<id>&horas=24&motivo=...`), `lib/auditoria.ts` (+`soporte_acceso_otorgado`,
  `soporte_acceso_revocado`).
- [ ] La página del panel resuelve id→email del operador con service_role del lado servidor
      (el display y el `operator_email` almacenado NUNCA salen del query string); muestra
      operador + alcance + duración ANTES de confirmar; el INSERT es de la sesión del admin
      (RLS). Tope 72h en CHECK, default UI 24h.
- [ ] Tests RLS: grant cross-tenant → 42501; miembro no otorga → 42501; extender
      expires_at → exception; revocar → OK; tenant suspendido no otorga → 42501; fixture de
      grants vigente/expirado/revocado.
- [ ] Commit.

### Task 7: Vista de soporte solo-lectura (allow-list, fail-closed, nominativa, banner, lint)

- Create: `apps/web/src/lib/soporte-datos.ts` (allow-list: cada función con columnas
  explícitas de la tabla de §6.5 del spec, nunca `select('*')`),
  `lib/autorizacion-plataforma.ts` → `autorizarSoporte(companyId, ruta)`,
  `app/admin/soporte/[companyId]/**` (ficha, centros, empleados-estado, ciclos-conteos,
  flags, difusión-metadata, programa-metadata, bitácora del tenant) + banner ámbar con
  "Terminar acceso".
- Modify: `eslint.config.mjs` (las tres guardias de §8 del spec), `lib/auditoria.ts`
  (+`soporte_vista_consultada`).
- [ ] `autorizarSoporte`: (1) autorizarPlataforma; (2) grant vigente cuyo
      `operator_user_id` === operador de la sesión — **un grant de A no abre nada a B
      (amenaza 15)**; (3) `registrarAuditoriaEstricta` en el audit_log DEL tenant por CADA
      página: sin evento no hay página.
- [ ] Unit tests: grant de A + sesión de B → rechazado SIN evento de vista; grant
      expirado/revocado → rechazado; auditoría fallida → sin página.
- [ ] Commit.

### Task 8: Vistas de métricas + dashboard operativo + test RLS de frontera

- Create: `supabase/migrations/20260714230000_plataforma_metricas.sql` (vistas
  `plataforma_metricas_organizaciones` y `plataforma_metricas_ciclos` + revoke/grant de
  §5 del spec), `apps/web/src/lib/metricas-plataforma.ts`, `app/admin/page.tsx`
  (organizaciones por estado, ciclos, tasa de respuesta agregada — nunca por centro
  pequeño).
- [ ] Test RLS: SELECT de ambas vistas como authenticated/anon → 42501. Revisión manual
      contra la lista PROHIBIDA de §5 (ni una columna derivada de salud).
- [ ] Commit.

### Task 9: Retención (recordatorios 1/30/60/85 + purga con acta-inventario) + E2E + docs + cierre

- Create: `app/api/cron/retencion/route.ts` (job PROPIO — decisión 6 y §2.5 del spec: NO
  tocar el cron de recordatorios; CRON_SECRET; idempotente por `platform_audit_log`
  `aviso_retencion_enviado` + `details.hito`; evento estricto ANTES del envío — aviso no
  probado no se envía), `scripts/purgar-empresa.mjs` (§2.6: verifica plazo Y los 4 avisos;
  genera acta `empresa_purgada` con INVENTARIO — conteos por entidad + sha256 de
  expedientes/informes/constancias desde `compliance_reports.sha256` y
  `dissemination_records.sha256` — verifica su escritura y SOLO entonces borra, incluido
  Storage; sin acta no hay purga), `apps/web/e2e/portal-plataforma.spec.ts`.
- Modify: `docs/manual.md` (sección del portal + soporte lado cliente), `docs/AUDITORIA.md`
  (dimensión 10: operar 200 organizaciones), `CLAUDE.md` (fila F5), versión 0.7.0 en
  `apps/web/package.json`.
- [ ] E2E: login admin con MFA forzado; suspensión visible y escritura bloqueada en el
      panel del tenant; solicitud → grant por deep link → página de soporte con evento
      verificado en BD; grant de A no abre para B. Unit del armado puro del acta
      (inventario + huellas) con TDD.
- [ ] Suites completas locales (motor, web, RLS, E2E, verificar:textos, build); PR; CI
      verde; merge; tag `v0.7-portal-plataforma`.
