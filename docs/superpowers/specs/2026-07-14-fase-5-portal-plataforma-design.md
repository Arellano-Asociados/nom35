# Fase 5 — Portal super-admin de plataforma (diseño)

**Fecha:** 2026-07-14 · **Rama:** `fase-5-portal-plataforma` · **Objetivo:** operar la
plataforma (organizaciones, flags, soporte, métricas) desde una UI `/admin` en vez de SQL a
mano, sin abrir ni un milímetro la frontera plataforma/tenant. Versión al cierre: 0.7.0.

## Principio rector

La identidad de plataforma se resuelve SIEMPRE por **fila real en `platform_users`
consultada por `auth.uid()`** — nunca por claim JWT (lección de
`20260713120000_membresia_sin_claim.sql`: el claim se desincroniza y duplica la fuente de
verdad). Y el acceso de plataforma a datos de tenant es SIEMPRE **service_role en servidor
detrás de un helper fail-closed**, jamás vía RLS — contrato ya documentado en el comentario
de `platform_users` (`20260711200001_esquema_global.sql:88`). Por eso NO existe
`app.es_plataforma()`: solo serviría para que alguien, dentro de un año, escribiera
`using (app.es_mi_tenant(company_id) or app.es_plataforma())` en una política — la puerta
que las reglas inviolables 4 y 5 prohíben. Que la tentación ni compile.

## Decisiones selladas con el propietario (2026-07-14) — no reabrir

1. **Alta de organizaciones: híbrido.** El registro autoservicio se conserva (funnel de
   prueba; nacen `active`) y el portal gana el alta operada por plataforma (crear empresa +
   invitar al primer admin por correo). Si mañana se quiere aprobar registros, se añade
   `pending_approval` al CHECK y el enforcement de suspensión lo cubre gratis.
2. **Suspensión por impago: solo lectura TOTAL, con descargas.** El panel queda en solo
   lectura incluida la descarga de informes/expedientes ya generados: la evidencia es del
   cliente y retenerla como palanca de cobranza es indefendible ante la LFPDPPP. La palanca
   es no poder operar: sin ciclos nuevos, sin distribuir, sin generar informes nuevos, sin
   correos; los empleados no pueden responder. La pantalla de suspensión dice explícito que
   las obligaciones NOM-035 siguen vigentes ante la autoridad con o sin la plataforma.
3. **Vista de soporte: solo lectura CON consentimiento.** Grant temporal que el admin del
   cliente crea con SU sesión vía RLS (acto criptográficamente suyo), default 24h, tope
   duro 72h en CHECK, revocable en un clic. Sin grant vigente, el operador no ve NADA del
   tenant. La impersonación completa queda DESCARTADA por escrito (§6.1).
4. **Baja: `pending_deletion` 90 días en solo lectura → purga física por script manual**
   con acta en la bitácora de plataforma (sobrevive a la purga). El plazo es una constante
   fácil de cambiar cuando el abogado fije el criterio; el mecanismo no cambia.
5. **Grant de soporte NOMINATIVO y SIN break-glass.**
   - a) El grant autoriza a UN operador específico (`operator_user_id`, FK a
     `platform_users`), no un acceso genérico de plataforma. `autorizarSoporte()` valida
     que el operador de la sesión sea exactamente el del grant vigente: un grant para el
     operador A no abre nada al operador B (amenaza 15).
   - b) Cualquier `es_admin_org` del tenant puede otorgar. El correo de solicitud al
     cliente lleva deep link a `/panel/[empresa]/soporte` con el grant pre-llenado
     (operador, alcance y duración visibles ANTES de confirmar); la confirmación ocurre
     SIEMPRE en el panel del cliente con su sesión, nunca desde el correo.
   - c) **SIN break-glass — si ningún admin del cliente puede otorgar el grant, soporte no
     entra. El camino de excepción sería el agujero del modelo de amenazas. Ninguna fase
     futura debe "arreglar" esto.**
6. **Recordatorios de baja.** Durante los 90 días de `pending_deletion` se envían avisos
   automáticos al cliente los días 1, 30, 60 y 85 ("descarga tu expediente final antes del
   DD/MM"), cada envío registrado en `platform_audit_log` — la purga solo es defendible si
   se puede probar que se avisó. Se implementan como **job propio de retención** (§2.5),
   no como excepción del cron de recordatorios existente.
7. **Acta de purga CON INVENTARIO.** El acta que sobrevive en `platform_audit_log` incluye
   el inventario de lo purgado — conteos por entidad y los sha256 de los expedientes y
   constancias que existieron (huellas, jamás contenido). Es la defensa de la plataforma en
   un litigio años después. El script la genera y **verifica su escritura ANTES de borrar**:
   sin acta escrita no hay purga (fail-closed, como todo lo demás).

## 1. Identidad de plataforma

### 1.1 `platform_users` ampliada (migración `..._plataforma_identidad.sql`)

```sql
alter table platform_users
  add column status text not null default 'invited'
    check (status in ('invited', 'active', 'disabled')),
  add column display_name text,
  add column invited_by uuid references platform_users (id),  -- null = bootstrap
  add column activated_at timestamptz,
  add column disabled_at timestamptz;
```

- Sin columna `role` (YAGNI: un solo rol de operador; si mañana hay perfiles, columna nueva
  con CHECK sin romper nada). `disabled` es la baja de operador — nunca DELETE
  (`invited_by` y la bitácora lo referencian).
- La política RLS existente (SELECT de la fila propia) se conserva tal cual: es lo único
  que `autorizarPlataforma()` lee con la sesión del operador. **Cero escrituras para
  `authenticated`** (patrón `feature_flags`).
- **Exclusión mutua operador↔tenant** (frontera de seguridad, en BD): trigger
  `app.rechazar_identidad_dual()` — BEFORE INSERT en `role_assignments`, `employees` y
  `consultant_assignments`: si el `auth_user_id` existe en `platform_users` → exception; y
  BEFORE INSERT en `platform_users`: si el `auth_user_id` tiene membresía en cualquiera de
  las tres → exception. Sin esto, una sola sesión colapsa las dos identidades y el
  razonamiento de fronteras se cae.

### 1.2 Alta de operadores

- **Bootstrap (primer operador):** `scripts/crear-operador.mjs` — Node con
  `SUPABASE_SERVICE_ROLE_KEY` de env (regla 9), protegido contra targets no locales salvo
  confirmación explícita (patrón `demo:seed`). Hace `auth.admin.createUser({ email,
password, email_confirm: true })` + INSERT `status='active'`, `invited_by=null` + evento
  `operador_creado_bootstrap`. Manual, una vez por entorno. **No existe signup público para
  `/admin`, nunca.**
- **Siguientes:** desde `/admin/operadores`, `accionInvitarOperador(email)` →
  `auth.admin.inviteUserByEmail` + INSERT `status='invited'` + evento `operador_invitado`.
  El flujo `/admin/activar` fija contraseña y **fuerza el enrolamiento TOTP como parte del
  alta** (sin factor verificado no hay transición a `active`). Los operadores autentican
  con contraseña + TOTP, no con magic link: para un alcance cross-tenant, un enlace en la
  bandeja es un vector de robo de sesión demasiado barato.
- Baja: `accionDeshabilitarOperador` → `status='disabled'` + `auth.admin.signOut` del
  usuario + evento. Un operador no puede deshabilitarse a sí mismo si es el último activo.

### 1.3 `autorizarPlataforma()` — capa app, fail-closed

```ts
// apps/web/src/lib/autorizacion-plataforma.ts
export interface OperadorPlataforma {
  authUserId: string; // auth.uid()
  operadorId: string; // platform_users.id
  email: string;
}
export const VENTANA_TOTP_ADMIN_MS = 4 * 60 * 60 * 1000; // sesión efectiva de /admin

export async function autorizarPlataforma(): Promise<OperadorPlataforma>;
```

Orden interno (cualquier paso falla → redirect; nunca "seguir con menos"):

1. Sesión (`clienteSesion()`); sin sesión → `/admin/ingresar`.
2. Fila propia en `platform_users` con `status='active'`, leída **con la sesión del
   operador** (la política de fila propia lo permite: único lugar del portal donde RLS
   trabaja a favor). Sin fila o no-active → `redirect('/ingresar')` (a la puerta del panel,
   sin revelar que `/admin` existe).
3. MFA y frescura (§1.4/§1.5).

**Convención de llamada:** TODA página y TODA acción de servidor bajo `/admin` llama
`autorizarPlataforma()` como primera línea — el layout no protege server actions. El layout
la llama además para UX (redirect temprano + banner).

### 1.4 MFA OBLIGATORIO (no condicional, como sí lo es en el panel)

```ts
const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
if (data.nextLevel === 'aal1') redirect('/admin/mfa/enrolar'); // SIN factor: enrolamiento forzado
if (data.currentLevel !== 'aal2') redirect('/admin/mfa/verificar'); // factor sin verificar
```

La diferencia con `/panel` (que degrada a aal1 si no hay factor): aquí el caso "no tiene
factor" **bloquea** en `/admin/mfa/enrolar` (enroll → challenge → verify, componentes
cliente en `src/components/` — trampa de corchetes). No hay camino a una página de `/admin`
con `currentLevel !== 'aal2'`.

### 1.5 Sesión efectiva corta — frescura TOTP por AMR

El timebox de GoTrue (168h/12h en `config.toml`) es global y compartido con el panel: no se
toca. La "sesión corta" de `/admin` es frescura de la última verificación TOTP, leída del
AMR que ya devuelve `getAuthenticatorAssuranceLevel()`:

```ts
const totp = data.currentAuthenticationMethods.find((m) => m.method === 'totp');
if (!totp || Date.now() - totp.timestamp * 1000 > VENTANA_TOTP_ADMIN_MS)
  redirect('/admin/mfa/verificar'); // re-verificar refresca el timestamp AMR
```

Ventana: **4 horas** (el operador comprometido es la amenaza nº 1; el costo es teclear un
TOTP dos veces por jornada). Constante en código, no en env — que no sea "configurable
hacia arriba" en silencio.

### 1.6 Descartado (con porqué, para no reabrir)

- **Claim JWT `is_platform`:** se desincroniza (operador deshabilitado con JWT vigente
  hasta 1h seguiría siendo "plataforma") y duplica la fuente de verdad. Costo de no
  tenerlo: un SELECT por request en `/admin`.
- **`app.es_plataforma()` en BD:** ver principio rector.

## 2. Gestión de organizaciones

### 2.1 Estado (migración `..._companies_status.sql`)

```sql
alter table companies
  add column status text not null default 'active'
    check (status in ('active', 'suspended', 'pending_deletion')),
  add column status_changed_at timestamptz,
  add column suspension_reason text,
  add column deletion_requested_at timestamptz;
```

Transiciones (validadas en la acción; cada una con evento en `platform_audit_log` —
estricta: sin bitácora no hay mutación — Y en el `audit_log` del tenant, porque el cliente
tiene derecho a ver en su propia bitácora que fue suspendido):
`active ↔ suspended` · `active|suspended → pending_deletion` ·
`pending_deletion → suspended` (arrepentimiento dentro del plazo) ·
`pending_deletion → purga física` SOLO por script manual (§2.6), nunca desde la UI.

### 2.2 Enforcement — BD-primero sin recrear las ~18 políticas

> **RESUELTO EN IMPLEMENTACIÓN (2026-07-14, acordado con el propietario).** El mecanismo
> originalmente especificado (inyectar `tenant_activo` DENTRO de
> `gestiona_tenant`/`es_admin_org`) era inviable: la verificación en `pg_policies` mostró
> **26 políticas de SELECT** que también delegan en esos helpers — la inyección habría
> dejado al tenant suspendido sin LECTURA, contra la decisión sellada 2. Mecanismo
> sustituto con la misma intención BD-primero: **políticas RESTRICTIVE por comando de
> escritura** (INSERT/UPDATE/DELETE) sobre toda tabla de tenant, generadas en un DO-loop
> (`as restrictive … using/with check (app.tenant_activo(company_id))`). Postgres las
> combina con AND sobre las permisivas existentes: helpers y políticas intactos, lecturas
> intactas, toda escritura de tenant no activo muere con 42501. Consecuencias: (a) toda
> tabla de tenant NUEVA (p. ej. `support_access_grants`, §6.2) debe añadir sus propias
> RESTRICTIVE en su migración — la nota d de §6.2 se cumple así, no vía `es_admin_org`;
> (b) `companies` lleva su RESTRICTIVE de UPDATE aparte (`tenant_activo(id)`).

```sql
create function app.tenant_activo(cid uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from companies where id = cid and status = 'active') $$;
```

Excepciones documentadas del candado: `platform_audit_log` (tabla de plataforma, su
`company_id` es dato, no tenancy) y `gr1_results` — la canalización clínica del RD
**SOBREVIVE a la suspensión** (atención a la salud del trabajador, no operación
comercial; recomendación del spec aceptada). Amenaza 12 cerrada con GRANT por columnas:
`revoke update on companies from authenticated; grant update (legal_name, rfc,
privacy_notice_version) …` — el estado es exclusivo de service_role.

**Capa app encima (caminos que RLS no cubre por ser service_role):**

1. `autorizarEmpresa()` gana `empresaStatus` en su retorno; el layout del panel muestra el
   aviso de suspensión y las acciones mutantes cortan temprano con mensaje claro (en vez de
   un 42501 críptico).
2. **Flujo del empleado (crítico):** corre con service_role. El helper de validación de
   token gana `companies.status = 'active'`; si no → página "Cuestionario no disponible
   temporalmente" SIN registrar respuesta. Sin esto, un tenant suspendido sigue acumulando
   datos de salud bajo un contrato en disputa.
3. **Cron de recordatorios y correos:** todo job filtra `companies.status = 'active'`. Un
   tenant suspendido no genera ni un correo (los recordatorios inducirían respuestas que el
   punto 2 rechazaría). Los avisos de retención NO pasan por este cron: §2.5.

### 2.3 Alta operada por plataforma

`/admin/organizaciones` → `accionCrearEmpresaPlataforma(razonSocial, rfc, emailAdmin)`:
crea `companies` + `auth.admin.inviteUserByEmail(emailAdmin)` + `role_assignments`
(`admin_org`) al aceptar. Reutiliza el bootstrap existente de `accionCrearEmpresa` (mismo
camino service_role justificado). Eventos: `empresa_creada_por_plataforma` (plataforma) +
`empresa_creada` (tenant, actor = operador).

### 2.4 Suspensión — experiencia del tenant

Banner persistente en el panel: "(a) tus obligaciones NOM-035 siguen vigentes ante la
autoridad; (b) tu evidencia histórica está disponible en modo lectura y puedes
descargarla; (c) los plazos de tus ciclos en curso quedan pausados en la plataforma, no
ante la autoridad". Descargas de `compliance_reports` existentes: PERMITIDAS (decisión 2).
Generar informes nuevos = INSERT → bloqueado por RLS. Empleados con token: pantalla de "no
disponible temporalmente".

### 2.5 Retención: job propio + recordatorios (decisión 6)

**Conflicto resuelto:** el cron de recordatorios existente (`/api/cron/recordatorios`)
filtra `status='active'`, lo que impediría avisar a un tenant en `pending_deletion`. Se
resuelve con un **job propio de retención** (`/api/cron/retencion`, `CRON_SECRET`), NO con
una excepción en el cron existente, por tres razones: (1) audiencias distintas — el cron
existente escribe a EMPLEADOS con tokens rotados; los avisos de retención van a los ADMINS
del tenant, sin tokens; (2) una excepción por estado en el cron de recordatorios
arriesgaría reactivar recordatorios de cuestionario a tenants no activos (exactamente lo
que §2.2.3 prohíbe) — la invariante "el cron de recordatorios jamás toca tenants no
activos" queda intacta; (3) bitácoras distintas — el aviso de retención es un acto de
plataforma y se registra en `platform_audit_log`, no en la bitácora del tenant.

Mecánica: para cada empresa en `pending_deletion`, calcula los días transcurridos desde
`deletion_requested_at` y envía el aviso de los hitos **1, 30, 60 y 85** ("descarga tu
expediente final antes del {fecha límite}") a los correos de sus `admin_org`. Idempotente
por bitácora: antes de enviar consulta `platform_audit_log` por
`aviso_retencion_enviado` con el mismo `company_id` + `details.hito`; si existe, no
reenvía (mismo patrón que la idempotencia de recordatorios de F3) + limitador
`app.golpe_limite`. **Fail-closed inverso al resto:** el evento se escribe con la variante
estricta ANTES del envío — si la bitácora falla, el aviso no se envía (un aviso no
probado no defiende la purga).

### 2.6 Purga con acta e inventario (decisión 7)

`scripts/purgar-empresa.mjs` (service_role, manual, doble confirmación tecleando el RFC):

1. Verifica `status='pending_deletion'` y `deletion_requested_at + RETENCION_DIAS (90) <
now()`. Verifica que existan los 4 avisos de retención en `platform_audit_log`; si
   falta alguno, ABORTA (la purga solo es defendible si se avisó).
2. **Genera el acta**: evento `empresa_purgada` con `details` =
   `{ legal_name, rfc, deletion_requested_at, avisos: [...4 fechas...], inventario:
{ centros, empleados, ciclos, asignaciones, respuestas, resultados, informes,
quejas, eventos_ats, constancias_difusion, programas }, huellas: {
expedientes: [{ciclo, sha256}], informes: [{ciclo, sha256}],
constancias: [{ciclo, version, sha256}] } }` — los sha256 salen de
   `compliance_reports.sha256` y `dissemination_records.sha256` (huellas ya almacenadas;
   JAMÁS contenido).
3. **Verifica la escritura del acta** (variante estricta + re-lectura por id). **Sin acta
   escrita no hay purga** — si falla, aborta sin tocar nada.
4. Solo entonces: DELETE en cascada (companies → todo lo del tenant, incluido su
   `audit_log`: la evidencia es del cliente y ya la exportó; conservarla tras la baja
   contradice la minimización LFPDPPP) + borrado de sus objetos de Storage
   (`informes/`, `evidencias/`, `politicas/`, logo).
5. `platform_audit_log.company_id` NO tiene FK a propósito: el acta sobrevive a la purga.

## 3. Feature flags desde UI

Ficha de la organización (`/admin/organizaciones/[companyId]`): tabla de flags conocidos
(`FLAGS` de `lib/flags.ts`) con toggle. `accionActualizarFlag(companyId, flag, enabled)`:
`autorizarPlataforma()` → upsert con service_role (la tabla ya es "solo plataforma
escribe": sin GRANT para authenticated) → **doble bitácora**: `flag_actualizado` en
`platform_audit_log` (estricta: sin evento no hay mutación, con operador, flag, valor
anterior→nuevo) + `flag_actualizado` en el `audit_log` del tenant (fire-and-forget, actor =
operador; el cliente ve que la plataforma le cambió un flag). Reemplaza el SQL manual.

## 4. Bitácora de plataforma (`platform_audit_log`)

Tabla SEPARADA — no se reutiliza `audit_log` con `company_id` nullable, por tres razones:
(1) `audit_log` es evidencia del tenant exhibible ante la STPS; relajar su `NOT NULL`
debilita la invariante de la tabla más sensible para acomodar eventos que el tenant jamás
debe leer; (2) lectores disjuntos (tenant lee la suya; solo operadores leen la de
plataforma); (3) retención OPUESTA (la del tenant se purga con la baja; la de plataforma
sobrevive como acta).

```sql
create table platform_audit_log (
  id bigint generated always as identity primary key,
  operator_id uuid references platform_users (id),  -- null = actor sistema (cron retención, scripts)
  event_type text not null,
  company_id uuid,          -- SIN FK a propósito: el acta sobrevive a la purga
  entity text, entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table platform_audit_log enable row level security;
-- Cero políticas y cero GRANTs para authenticated (patrón feature_flags): solo service_role.
-- Append-only: triggers de rechazo de UPDATE/DELETE/TRUNCATE (app.rechazar_modificacion).
```

Helper espejo `apps/web/src/lib/auditoria-plataforma.ts` con catálogo cerrado:

```ts
export const EVENTOS_PLATAFORMA = {
  operadorCreadoBootstrap: 'operador_creado_bootstrap',
  operadorInvitado: 'operador_invitado',
  operadorActivado: 'operador_activado',
  operadorDeshabilitado: 'operador_deshabilitado',
  empresaCreadaPorPlataforma: 'empresa_creada_por_plataforma',
  empresaSuspendida: 'empresa_suspendida',
  empresaReactivada: 'empresa_reactivada',
  empresaBajaSolicitada: 'empresa_baja_solicitada',
  avisoRetencionEnviado: 'aviso_retencion_enviado',
  empresaPurgada: 'empresa_purgada',
  flagActualizado: 'flag_actualizado',
  soporteAccesoSolicitado: 'soporte_acceso_solicitado',
} as const;
// registrarAuditoriaPlataforma / ...Estricta — mismas firmas que lib/auditoria.ts
```

**Regla de doble escritura:** todo evento de plataforma que afecta a UN tenant (flag,
suspensión, baja, grant) va a `platform_audit_log` (estricta) Y al `audit_log` del tenant
(fire-and-forget). Lector: `/admin/bitacora` (service_role tras `autorizarPlataforma()`),
filtrable por operador/empresa/evento. El catálogo del tenant (`EVENTOS_AUDITORIA` en
`lib/auditoria.ts`) gana: `empresa_suspendida`, `empresa_reactivada`,
`empresa_baja_solicitada`, `flag_actualizado`, `soporte_acceso_otorgado`,
`soporte_acceso_revocado`, `soporte_vista_consultada`.

## 5. Métricas cross-tenant (solo operativas)

**Vistas SQL dedicadas con GRANT exclusivo a service_role** — la frontera se expresa UNA
vez, en una migración revisable y testeable; el código de la app no puede "driftear" hacia
columnas prohibidas porque la vista no las tiene.

```sql
create view plataforma_metricas_organizaciones as
  select c.id, c.legal_name, c.rfc, c.status, c.created_at,
         (select count(*) from work_centers w where w.company_id = c.id) as centros,
         (select count(*) from employees e where e.company_id = c.id and e.active) as empleados
  from companies c;

create view plataforma_metricas_ciclos as
  select cc.id, cc.company_id, cc.date_start, cc.date_end,
         (cc.traumatic_event_id is not null) as es_evento_ats,
         count(qa.*) as asignaciones,
         count(qa.*) filter (where qa.completed_at is not null) as completadas
  from compliance_cycles cc
  left join questionnaire_assignments qa on qa.cycle_id = cc.id
  group by cc.id;

revoke all on plataforma_metricas_organizaciones, plataforma_metricas_ciclos
  from public, anon, authenticated;
grant select on plataforma_metricas_organizaciones, plataforma_metricas_ciclos to service_role;
```

**PERMITIDO (exhaustivo):** `companies` (id, legal_name, rfc, status, created_at) ·
`work_centers` (conteo, categoría normativa) · `employees` (**CONTEO únicamente** — ni
nombres ni correos en métricas) · `compliance_cycles` (id, fechas, marca ATS) ·
`questionnaire_assignments` (**conteos por estado** — jamás token_hash ni employee_id) ·
`feature_flags` · `platform_users` · `platform_audit_log` · `support_access_grants`.

**PROHIBIDO (la frontera):** `responses` · `risk_results` · `gr1_results` · registros 5.8 ·
buzón de quejas (**ni conteos**: la frontera nítida vale más que una métrica de volumen) ·
contenido de `compliance_reports`/expedientes · contenido de difusiones · evidencias de
Storage · `audit_log` de tenants (fuera de la vista de soporte) · **cualquier agregado
derivado de salud, aunque tenga supresión n<3** — la regla 4 no distingue "agregado bien
suprimido": la plataforma no ve NADA derivado de resultados.

La "tasa de respuesta" (completadas/asignaciones) es participación — conducta operativa que
el propio tenant ya expone como evidencia de proceso — y se muestra solo a nivel
empresa/ciclo o global, nunca por centro pequeño.

## 6. Vista de soporte solo-lectura con consentimiento nominativo

### 6.1 Impersonación completa: descartada (que quede escrito)

1. **Falsifica la cadena de evidencia**: el `audit_log` del tenant atribuiría actos del
   operador al usuario del cliente. Para un producto cuyo diferenciador es evidencia
   auditable exhibible ante la STPS, es un defecto existencial, no un trade-off.
2. **Viola las reglas 4 y 5 por herencia**: impersonar al RD da a la plataforma acceso a
   resultados individuales. Las reglas inviolables no admiten flags — la impersonación es
   precisamente un flag universal.
3. **Tokens reales acuñados**: GoTrue no tiene impersonación nativa; habría que acuñar
   sesiones vía admin API — bearer tokens robables que sobreviven a la intención.
4. **Escritura = radio de explosión**: la solo-lectura convierte "operador comprometido" en
   una fuga (grave) en vez de una manipulación de evidencia (fatal).

### 6.2 `support_access_grants` (migración `..._support_access_grants.sql`)

```sql
create table support_access_grants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  -- Decisión 5a: el grant es NOMINATIVO — autoriza a UN operador, no a "la plataforma".
  operator_user_id uuid not null references platform_users (id),
  -- Desnormalizado para que el tenant vea a quién autorizó sin poder leer platform_users.
  operator_email text not null,
  granted_by_user_id uuid not null,  -- auth.uid() del admin_org que consiente (sin FK, convención audit_log)
  reason text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by_user_id uuid,
  constraint grant_duracion_maxima check (expires_at <= created_at + interval '72 hours'),
  constraint grant_expira_futuro check (expires_at > created_at)
);
alter table support_access_grants enable row level security;
create policy grants_select on support_access_grants for select
  using (app.es_mi_tenant(company_id));  -- todo el tenant VE los accesos (transparencia)
create policy grants_insert on support_access_grants for insert
  with check (app.es_admin_org(company_id) and granted_by_user_id = auth.uid());
create policy grants_update on support_access_grants for update
  using (app.es_admin_org(company_id));
-- Trigger app.solo_revocacion(): en UPDATE solo pueden cambiar revoked_at/revoked_by_user_id,
-- y solo de null a valor. Extender expires_at o cambiar operator_user_id = exception.
grant select, insert, update on support_access_grants to authenticated;
grant all on support_access_grants to service_role;
```

Notas: (a) el consentimiento lo crea el tenant con SU sesión vía RLS — acto
criptográficamente del cliente, no un registro que la plataforma se auto-escribe; (b) tope
duro 72h en CHECK, default de la UI 24h; (c) la revocación es lo único mutable y en una
sola dirección; (d) como `es_admin_org` lleva `tenant_activo` (§2.2), un tenant suspendido
no puede otorgar grants — correcto: para soportar a un suspendido, la plataforma usa sus
superficies propias (`/admin/organizaciones/[id]`), no la vista de tenant.

### 6.3 Flujo de solicitud con deep link (decisión 5b)

1. El operador, desde la ficha de la organización, ejecuta `accionSolicitarAcceso(companyId,
motivo, horas)` → evento `soporte_acceso_solicitado` (plataforma) + correo a los
   `admin_org` del tenant con deep link a
   `/panel/[empresa]/soporte?operador=<platform_users.id>&horas=24&motivo=...`.
2. La página del panel PRE-LLENA el formulario: resuelve el id → email/nombre del operador
   con una consulta service_role del lado servidor (lectura puntual justificada: el tenant
   no puede leer `platform_users`, y el display NO debe confiar en parámetros del URL —
   el `operator_email` almacenado sale de esa resolución, jamás del query string). El
   admin ve **operador, alcance (solo lectura, superficies listadas) y duración ANTES de
   confirmar**.
3. La confirmación es un submit con la sesión del admin (INSERT vía RLS). Nunca se otorga
   desde el correo: el deep link solo pre-llena.

### 6.4 `autorizarSoporte()` — nominativo y fail-closed por página

```ts
export interface AccesoSoporte extends OperadorPlataforma {
  grantId: string;
  companyId: string;
  expiresAt: string;
}
export async function autorizarSoporte(companyId: string, ruta: string): Promise<AccesoSoporte>;
```

1. `autorizarPlataforma()` (aal2 + frescura TOTP).
2. Grant vigente para ese tenant **cuyo `operator_user_id` es EXACTAMENTE el
   `platform_users.id` de la sesión** (decisión 5a) y `revoked_at is null` y
   `expires_at > now()` (service_role). Un grant del operador A no abre nada al B.
3. `registrarAuditoriaEstricta(companyId, operador.authUserId,
'soporte_vista_consultada', 'support_grant', grantId, { ruta, operador_email })` en el
   **`audit_log` DEL tenant** — si devuelve `false`, redirect: **sin evento no hay página**
   (regla 5 aplicada a nosotros mismos).

### 6.5 Frontera de superficies (reglas 4 y 5 aplican al operador)

| Puede ver (solo lectura)                                        | NUNCA ve                                            |
| --------------------------------------------------------------- | --------------------------------------------------- |
| Ficha de empresa, centros, categoría normativa                  | `responses` (regla 4: el operador ES lado patronal) |
| Empleados (nombre, centro, estado de asignación)                | `risk_results`, `gr1_results`, registros 5.8        |
| Ciclos: fechas, guías, conteos asignadas/completadas            | Dashboards/distribuciones de riesgo (aun con n<3)   |
| Cuestionarios propios (estructura, jamás respuestas)            | Contenido de `compliance_reports`/expedientes       |
| Feature flags de la empresa                                     | Contenido de quejas (solo conteo por estado)        |
| Constancias de difusión (metadata + conteo de acuses)           | Tokens de asignación (capacidad del empleado)       |
| Programa de intervención (metadata de acciones, sin evidencias) | Storage de evidencias                               |
| `audit_log` del tenant (es soporte de "¿qué pasó?")             |                                                     |

**Inescapable en código:** las páginas de soporte consumen EXCLUSIVAMENTE
`lib/soporte-datos.ts`, módulo allow-list donde cada función selecciona columnas explícitas
(nunca `select('*')`). Lint bidireccional (patrón `difusion-datos`): `supabase-admin`
prohibido en `app/admin/soporte/**`; `soporte-datos` prohibido fuera de ahí.

### 6.6 Transparencia bilateral

- **Operador:** banner ámbar persistente — "Vista de soporte SOLO LECTURA — {empresa} —
  expira {hh:mm} — cada página consultada queda registrada en la bitácora del cliente" +
  botón "Terminar acceso" (revoca su propio grant).
- **Cliente:** `/panel/[empresa]/soporte` lista grants vigentes/históricos (SELECT vía RLS)
  con revocación en un clic; aviso discreto en el layout del panel mientras haya un grant
  vigente. El cliente ve quién, hasta cuándo y qué páginas (su bitácora).

## 7. Modelo de amenazas

| #   | Amenaza                                                                     | Mitigación                                                                                                     | Test nuevo                                                                                                                          |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Operador comprometido (credencial robada)                                   | TOTP obligatorio + frescura 4h; solo-lectura; grants ≤72h nominativos; doble bitácora                          | Unit/E2E: `/admin` sin aal2 redirige; AMR viejo redirige                                                                            |
| 2   | Operador malicioso intenta leer respuestas/resultados                       | Allow-list `soporte-datos` + lint bidireccional; vistas de métricas sin columnas prohibidas; evento por página | RLS: SELECT de `plataforma_metricas_*` como authenticated → 42501. Riesgo residual declarado: service_role omnipotente (§7.1)       |
| 3   | Escalada tenant→plataforma: admin_org se inserta en `platform_users`        | Sin GRANT de escritura para authenticated                                                                      | INSERT/UPDATE/DELETE `platform_users` como admin_org → 42501                                                                        |
| 4   | admin_org lee `platform_audit_log` o filas ajenas de `platform_users`       | Sin GRANT / política fila-propia                                                                               | SELECT `platform_audit_log` → 42501; SELECT `platform_users` → 0 filas para usuario tenant                                          |
| 5   | admin_org de A forja/lee grant para tenant B                                | `with check (es_admin_org(company_id))`                                                                        | INSERT grant con company_id de B → 42501; SELECT grants de B → 0 filas                                                              |
| 6   | Tenant extiende un grant vigente (72h → ∞)                                  | Trigger `solo_revocacion`                                                                                      | UPDATE `expires_at` → exception; UPDATE `revoked_at` → OK                                                                           |
| 7   | `miembro` (no admin) otorga grant en su empresa                             | Política INSERT exige `es_admin_org`                                                                           | INSERT como miembro → 42501                                                                                                         |
| 8   | Grant expirado/revocado reutilizado                                         | `autorizarSoporte` verifica vigencia + evento estricto                                                         | Unit de `autorizarSoporte` (camino service_role, no RLS-testeable)                                                                  |
| 9   | Plataforma→tenant sin grant: operador usa su sesión contra tablas de tenant | Operador sin membresías → `es_mi_tenant` = false                                                               | Fixture "operador": SELECT `companies`/`employees`/`responses` → 0 filas / 42501                                                    |
| 10  | Identidad dual operador+tenant                                              | Trigger exclusión mutua (§1.1)                                                                                 | INSERT membresía para el usuario-operador → exception; e inverso                                                                    |
| 11  | Tenant suspendido sigue operando                                            | `tenant_activo` dentro de `gestiona_tenant`/`es_admin_org` + check token + filtro cron                         | Fixture tenant C suspendido: INSERT ciclo como su admin → 42501; SELECT → filas OK; INSERT grant → 42501                            |
| 12  | admin_org se auto-reactiva (`UPDATE companies.status`)                      | Sin política de UPDATE de `status` para authenticated (verificar política actual de `companies`)               | UPDATE `companies.status` como admin_org → 42501                                                                                    |
| 13  | Tenant se auto-concede flags                                                | Ya mitigado (feature_flags); sin regresión con la UI nueva                                                     | Ya existe; se conserva                                                                                                              |
| 14  | Claim JWT falsificado/desfasado                                             | No existe claim de plataforma (§1.6)                                                                           | El test 9 simula JWT arbitrario sin membresía                                                                                       |
| 15  | **Grant otorgado al operador A usado por el operador B** (decisión 5a)      | `autorizarSoporte` compara el `platform_users.id` de la sesión contra `operator_user_id` del grant             | Unit de `autorizarSoporte` (grant de A, sesión de B → rechazado y SIN evento de vista) + E2E; en RLS, la FK valida que el id exista |

### 7.1 Riesgo residual declarado

`service_role` sigue siendo omnipotente: la mitigación real contra el operador/desarrollador
malicioso es el camino pavimentado angosto (allow-list + lint + vistas + doble bitácora +
revisión de código). Endurecimiento futuro barato que este diseño deja preparado: rol
Postgres dedicado `plataforma_lector` con GRANT solo a las vistas de métricas y a
`soporte-datos`, por conexión propia — las vistas de §5 hacen esa migración trivial.

**Fixtures nuevos de `packages/pruebas-rls`:** tenant C con `status='suspended'`, usuario
"operador" en `platform_users` sin membresías, grants vigente/expirado/revocado.
Estimación: ~18–20 tests nuevos sobre los 64 (siguen siendo gate de CI).

## 8. Transversales

- Rutas: `app/admin/**` (layout con banner, `ingresar`, `activar`, `mfa/enrolar`,
  `mfa/verificar`, `page` = métricas, `organizaciones`, `organizaciones/[companyId]`,
  `operadores`, `bitacora`, `soporte/[companyId]/**`) + `app/panel/[empresa]/soporte`.
- Lint (eslint.config.mjs raíz): (a) `supabase-admin` prohibido en `app/admin/soporte/**`;
  (b) `soporte-datos` prohibido fuera de `app/admin/soporte/**`; (c)
  `autorizacion-plataforma` y `soporte-datos` prohibidos en `app/panel/**` — las fronteras
  no se cruzan ni por accidente.
- Scripts: `crear-operador.mjs`, `purgar-empresa.mjs` (ambos protegidos contra targets no
  locales sin confirmación explícita, patrón `demo:seed`).
- E2E nuevo `portal-plataforma.spec.ts`: login admin con MFA forzado; suspensión visible en
  el panel del tenant y escritura bloqueada; solicitud → grant con deep link → página de
  soporte con evento verificado en BD; grant de A no abre para B.
- Docs: manual (sección del portal + soporte lado cliente), AUDITORIA.md (dimensión 10:
  "operar 200 organizaciones"), CLAUDE.md (fila F5). Versión 0.7.0.
