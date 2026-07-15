# Arquitectura de Constata

Documento de consolidación: reúne en un solo lugar lo que está repartido entre los specs de
diseño y el código. Para el detalle de cada decisión, sigue los enlaces a los specs originales
en [§7](#7-decisiones-selladas-y-specs). Las reglas de negocio inviolables que gobiernan todo
están en [CLAUDE.md §3](../CLAUDE.md).

## 1. Vista general

Constata es una plataforma **multi-tenant** que digitaliza el ciclo de cumplimiento de la
NOM-035-STPS-2018. El principio rector es la **evidencia auditable e inmutable**: nada de lo que
sirve como prueba ante una inspección se puede editar o borrar, y los datos de salud de los
trabajadores jamás son visibles para ningún rol patronal.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Navegador                                                            │
│   · Panel del tenant (/panel)      · Flujo del empleado (por token)   │
│   · Portal de plataforma (/admin)  · Buzón / ARCO (público)           │
└───────────────┬─────────────────────────────────────────────────────┘
                │  Server Components + Server Actions (Next.js 15)
┌───────────────┴─────────────────────────────────────────────────────┐
│  apps/web                                                            │
│   · clienteSesion()  → Supabase con la sesión del usuario (RLS real) │
│   · clienteAdmin()   → service_role, SOLO en usos justificados       │
│   · lib/ia, lib/soporte-datos, lib/tablero-datos … (allow-lists)     │
└───────────────┬───────────────────────────┬──────────────────────────┘
                │                           │
        packages/motor-nom035        Supabase (Postgres + RLS + Auth + Storage)
        (cálculo puro, sin I/O)       · migraciones versionadas
                                      · triggers de inmutabilidad
                                      · políticas RLS por tabla
                │
        Proveedores externos: Anthropic (IA), Resend (correo)
        detrás de interfaces propias (ProveedorIA, MailProvider)
```

## 2. Módulos (monorepo pnpm)

| Paquete                 | Responsabilidad                                                                         | Notas                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/motor-nom035` | Cálculo de las Guías I/II/III: funciones **puras**, sin I/O ni framework                | TDD estricto. Las matrices viven en TABLAS DE DATOS, no en el código (regla 7). |
| `packages/pruebas-rls`  | Suite de aislamiento multi-tenant contra Postgres real                                  | **Gate de CI**: simula usuarios (SET ROLE + claims) como PostgREST.             |
| `supabase/`             | Migraciones SQL, políticas RLS, seeds normativos                                        | ~30 migraciones reproducibles desde cero.                                       |
| `apps/web`              | Next.js 15: panel del tenant, flujo del empleado, portal `/admin`, acciones de servidor | RLS real con `clienteSesion()`; `service_role` solo en usos comentados.         |
| `scripts/`              | Seeds de demo, verificación de textos oficiales, bootstrap de operador, purga           | Todos con guard anti-producción donde aplica.                                   |

**Convenciones por paquete** (se cargan solas al trabajar ahí): `apps/web/CLAUDE.md` (flujo del
empleado, trampas de Next/Playwright, `clienteSesion()` vs `service_role`) y
`packages/motor-nom035/CLAUDE.md` (reglas normativas de GR-I/II/III).

## 3. Modelo de datos

Toda tabla de tenant lleva `company_id` con **RLS activo** y **GRANT explícito por rol** (mínimo
privilegio). Las cadenas de FKs son compuestas `(company_id, id)` para impedir cruces entre
empresas. La categoría normativa de un centro se deriva por trigger de su headcount (umbrales
15/16 y 50/51).

**Catálogo normativo (global, lectura pública):** `questionnaires`, `questions`,
`scoring_rules`, `item_structure`, `risk_level_ranges`. Las matrices de la norma son DATOS aquí,
verificadas contra el DOF por el gate `verificar:textos`.

**Estructura del tenant:** `companies` (con `status` active/suspended/pending_deletion),
`work_centers`, `employees`, `role_assignments`, `consultant_assignments`.

**Ciclo de evaluación:** `compliance_cycles`, `questionnaire_assignments`, `consents`,
`responses` (append-only), `risk_results` / `gr1_results` (append-only; recálculo = fila nueva
con `supersedes_id`), `action_items`, `intervention_programs`.

**Evidencia y proceso:** `policies` / `policy_acknowledgments`, `training_contents` /
`training_records`, `compliance_reports`, `dissemination_records` / `dissemination_receipts`,
`traumatic_events`, `complaints` / `complaint_boxes` / `complaint_events`, `audit_log`
(append-only), `privacy_notices`, `arco_requests`.

**Configurabilidad:** `company_settings`, `mail_templates`, `feature_flags`,
`custom_questionnaires` / `custom_assignments` / `custom_answers`.

**Plataforma e IA:** `platform_users`, `platform_audit_log`, `support_access_grants`,
`ai_drafts` (append-only con sello del insumo), `rate_limits`, `system_config`.

**Inmutabilidad en BD:** triggers rechazan UPDATE/DELETE en las tablas de evidencia
(`responses`, `risk_results`, `audit_log`, `consents`, `dissemination_records`, `complaints`
salvo su estado, `ai_drafts` salvo la adopción, etc.). La inmutabilidad no depende del código de
la app: la impone la base de datos.

## 4. Roles y matriz de permisos

| Rol                              | Cómo se obtiene                       | Alcance                                                                                                  |
| -------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Admin de Organización**        | Registro/alta de la empresa           | Opera el panel completo de su tenant (crear, distribuir, informes).                                      |
| **Consultor**                    | Asignación por un admin               | Mismos permisos de gestión que el admin, en las empresas asignadas; no designa RD ni agrega consultores. |
| **Miembro**                      | Alta manual                           | No opera; existe para portar el flag de RD.                                                              |
| **Responsable Designado (flag)** | "Designarme RD" (sobre cualquier rol) | ÚNICO que ve resultados individuales y atiende canalizaciones; cada consulta se audita.                  |
| **Empleado**                     | Enlace tokenizado                     | Responde su propio cuestionario y ve su propio resultado; nunca tiene cuenta de panel.                   |
| **Operador de plataforma**       | `pnpm operador:crear` / invitación    | Opera `/admin` (organizaciones, flags, soporte, métricas); jamás miembro de un tenant (exclusión dual).  |

La matriz detallada por acción (quién ve qué) está en
[docs/manual.md §3.12](manual.md). La regla capital: **respuestas crudas ítem por ítem — nadie
del lado patronal, sin excepción** (ni siquiera con GRANT de SELECT a nivel de BD).

## 5. Las cinco fronteras

Constata tiene cinco fronteras de seguridad/privacidad. Cada una se impone **en código o en la
base de datos**, nunca por confianza.

### 5.1 Aislamiento multi-tenant (RLS)

`company_id` se deriva SIEMPRE del JWT (claim puesto por el hook `app.custom_access_token` desde
la membresía real), jamás del request. Toda tabla de tenant tiene RLS y sus políticas
**re-verifican la membresía** (el claim solo no basta). El panel opera con `clienteSesion()` para
que RLS sea la defensa real; `service_role` solo en usos justificados y comentados, con una
guardia de lint que lo prohíbe en el panel. La suite `packages/pruebas-rls` es **gate de CI**.

### 5.2 Anti-reidentificación (supresión n<3)

Los agregados son **distribuciones y conteos, jamás promedios** (regla 2). Toda celda con
`0 < n < 3` se suprime, y si alguna celda de una fila se suprime, **se enmascara la FILA
COMPLETA** (incluidos ceros y total): publicar los ceros a un lado revelaría el atributo del
individuo. Vive en `lib/agregados.ts` y aplica igual al informe exportable. Limitación abierta
documentada: la inferencia por diferencia temporal sobre agregados en vivo (ver [§8](#8-deuda-y-límites)).

### 5.3 Frontera de soporte (grant nominativo, sin break-glass) — F5

El equipo de Constata no ve nada de un tenant por defecto. El acceso de soporte exige un **grant
NOMINATIVO** que el admin del cliente crea **con su sesión** (acto criptográficamente suyo),
para un operador específico, de solo lectura, ≤72h, revocable. `autorizarSoporte()` comprueba
que el operador de la sesión sea exactamente el del grant y deja un **evento estricto por
página** en la bitácora del tenant (sin evento no hay página). La vista consume solo la
allow-list `lib/soporte-datos.ts` (columnas explícitas). **SIN break-glass**: si nadie del
cliente otorga el grant, soporte no entra — ninguna fase futura debe "arreglar" esto.

### 5.4 Frontera plataforma ↔ tenant — F5

La identidad de plataforma es una **fila real en `platform_users`** consultada por `auth.uid()`
(sin claim JWT, sin `app.es_plataforma()` en BD — a propósito: sería la puerta que las reglas 4
y 5 prohíben). El acceso de plataforma a datos de tenant es `service_role` tras helpers
fail-closed. La suspensión es **solo lectura a nivel de BD** vía políticas RESTRICTIVE por
comando de escritura (toda tabla de tenant nueva añade las suyas). MFA TOTP obligatorio con
frescura de 4h. La purga física es solo por script manual con **acta de inventario** verificada
antes de borrar.

### 5.5 Frontera de la IA (allow-list) — F6

La IA solo recibe lo que arma `lib/ia/ia-datos.ts`: **agregados ya suprimidos** (todo pasa por
`agregados.ts`) + el catálogo Tabla 4/7. Nunca responses, resultados individuales, registros
5.8, buzón (ni conteos) ni nombres de empleados. Anti prompt-injection **estructural** (JSON
canónico delimitado, strings del tenant como valores truncados, system prompt fijo, salida
validada). La llamada sale del servidor tras `ProveedorIA` (`@anthropic-ai/sdk` solo en
`lib/ia/proveedor.ts`; guardias de lint bidireccionales). El texto vive en `ai_drafts`
append-only con la **terna reproducible** (`insumo_sha256` + `prompt_version` + modelo); la
adopción es un acto humano de una sola vía y la IA jamás escribe en el programa.

## 6. Flujos transversales

- **Auditoría:** `lib/auditoria.ts` (catálogo cerrado de eventos) y `lib/auditoria-plataforma.ts`
  para la bitácora de plataforma. Variantes normal (fire-and-forget) y **estricta** (sin evento
  no hay mutación/consulta).
- **Correo:** interfaz `MailProvider` (Resend / Mailpit / Nulo). Los correos jamás llevan datos
  sensibles.
- **Límite de tasa:** contador de ventana fija en BD (`app.golpe_limite`, wrapper REST), con
  política de fallo **por endpoint** — fail-closed donde el límite ES la protección (ARCO,
  buzón, adivinación de tokens), fail-open donde es idempotencia de usuarios autorizados.
- **Sellado:** `lib/cuestionarios-sello.ts` (`selloCanonico`) produce el sha256 reproducible de
  cuestionarios publicados, constancias de difusión, instrumentos del expediente e insumos de IA.

## 7. Decisiones selladas y specs

Cada fase con diseño no trivial dejó un spec con sus decisiones selladas (no reabrir). Los
milestones tempranos (M0–M7, F1.5, F2, F2.5, F3) preceden a esta convención y su detalle vive en
[docs/historia-milestones.md](historia-milestones.md).

| Fase                      | Spec                                                                                                                   | Decisiones selladas destacadas                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F4 — Ciclo normativo      | [2026-07-13-fase-4-ciclo-normativo-design.md](superpowers/specs/2026-07-13-fase-4-ciclo-normativo-design.md)           | Difusión sellada, buzón con estándar de dato sensible, programa 8.3–8.5 con criterios en datos.                                                                           |
| F4.5 — Remates normativos | [2026-07-14-fase-4.5-remates-normativos-design.md](superpowers/specs/2026-07-14-fase-4.5-remates-normativos-design.md) | Eventos ATS con GR-I solo a expuestos, informe renombrado a 7.7, registros 5.8.                                                                                           |
| F5 — Portal de plataforma | [2026-07-14-fase-5-portal-plataforma-design.md](superpowers/specs/2026-07-14-fase-5-portal-plataforma-design.md)       | 7 decisiones: identidad por fila real, suspensión solo-lectura, soporte nominativo sin break-glass, baja con retención y purga con acta.                                  |
| F6 — Inteligencia         | [2026-07-14-fase-6-inteligencia-design.md](superpowers/specs/2026-07-14-fase-6-inteligencia-design.md)                 | 7 decisiones: allow-list de IA, persistencia append-only con sello del insumo, flag + limitador fail-closed, borrador inconfundible y no exportable, prompts versionados. |

## 8. Deuda y límites

La deuda abierta reconocida (dependencias externas y una limitación de producto) está en
[docs/AUDITORIA.md](AUDITORIA.md) y, como checklist pre-producción, al inicio de
[docs/DESPLIEGUE.md](DESPLIEGUE.md). En resumen: la **deuda normativa está vacía**; lo que queda
es externo (validación del motor por consultor, textos legales del aviso/DPA, criterio de
retención) más una limitación conocida (inferencia temporal sobre agregados en vivo, que exige
instantáneas en lugar de agregados en vivo para cerrarse).
