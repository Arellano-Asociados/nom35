# Fase 6 — Inteligencia y experiencia ejecutiva (diseño)

**Fecha:** 2026-07-14 · **Rama de diseño:** `fase-6-inteligencia` · **Objetivo:** dashboard
ejecutivo al entrar al panel + resumen ejecutivo y plan de acción asistidos por IA, con la
misma disciplina de frontera que la vista de soporte de F5: la IA solo ve agregados ya
suprimidos, el humano firma todo. Versión al cierre: 0.8.0.

## Principio rector

La IA es un **redactor de borradores sobre agregados ya suprimidos** — nunca una fuente de
verdad normativa ni un lector de datos crudos. Las reglas inviolables 2, 3, 4 y 5 aplican
al proveedor de IA exactamente igual que al operador de soporte de F5: la frontera se
impone **en código con allow-list + lint**, jamás por confianza en un prompt ("no mires
los datos sensibles" no es un control; que los datos no lleguen sí). Y la IA **propone, el
humano dispone y firma**: ningún texto generado entra a un documento, programa o evidencia
sin adopción explícita de un usuario identificado — en un producto de evidencia legal, el
origen del texto es parte de la evidencia.

## Decisiones selladas con el propietario (2026-07-14) — no reabrir

1. **Proveedor: API de Anthropic, modelo Haiku 4.5.** Integración detrás de una interfaz
   propia `ProveedorIA` (patrón `MailProvider`: Resend/Mailpit/Nulo). El modelo vive en
   env `IA_MODELO` con default `claude-haiku-4-5-20251001` (cambiar de modelo no toca
   código). `ANTHROPIC_API_KEY` **solo en el servidor** (jamás `NEXT_PUBLIC_*`): la llamada
   sale siempre de nuestro servidor, nunca del navegador. Sin API key → `ProveedorNulo`
   (función desactivada con aviso; CI y desarrollo sin red).
2. **Persistencia: `ai_drafts` append-only con sello del insumo.** Cada generación guarda
   el texto + modelo + `prompt_version` + el **insumo JSON canónico completo** y su
   `insumo_sha256`. Regenerar = fila nueva. Razones: (a) años después se puede probar QUÉ
   vio la IA (el insumo es agregado ya suprimido: almacenarlo es legal); (b) congela el
   insumo — no re-consulta agregados en vivo en cada vista, así que no empeora la
   inferencia temporal documentada; (c) el costo es 1 llamada por generación explícita.
3. **Flag único `ia_asistida`, default OFF** (mecanismo de flags existente: toggle en la
   ficha de `/admin` con doble bitácora). Cubre resumen ejecutivo Y plan de acción. El
   costo fino lo gobierna un limitador **fail-closed** de 10 generaciones/día/ciclo
   (`alFallar: 'rechazar'`): aquí el límite ES la protección de costo — con el limitador
   caído, fail-open sería llamadas ilimitadas a una API que cobra por token. Que el botón
   diga "intenta más tarde" durante una avería es un costo trivial; una factura sorpresa no.
4. **El dashboard ejecutivo es el nuevo inicio del panel** (`/panel/[empresa]`) cuando ya
   hay operación (≥1 ciclo con asignaciones); mientras falten pasos del arranque se
   conserva el checklist de onboarding actual.
5. **`ai_drafts` es dato del TENANT** — retención y soporte explícitos:
   - a) Entra al **inventario del acta de purga** (conteo `borradores_ia` en
     `armarActaPurga`) y **se purga con el tenant** (tiene `company_id`: el DELETE del
     script lo barre; el acta con el conteo sobrevive en `platform_audit_log`).
   - b) La vista de soporte de F5 ve **SOLO metadata** (tipo, fechas, modelo,
     `prompt_version`, adoptado o no) vía una función nueva de columnas explícitas en
     `soporte-datos.ts`. El **texto y el insumo jamás**: contienen la interpretación de
     resultados del tenant y sus nombres de centros — misma frontera que el resto de la
     allow-list de soporte.
6. **Prompts versionados en código** (`lib/ia/prompts.ts`, constantes numeradas —
   `PROMPT_RESUMEN_V1`, `PROMPT_PLAN_V1` — jamás strings inline). La respuesta reproducible
   a "¿por qué el resumen de marzo dice X?" es la terna `insumo_sha256` + `prompt_version`
   - `modelo`; sin el prompt versionado en código, la tercera pata coja.
7. **Un borrador NO adoptado es visualmente inconfundible y no exportable.** Marca visual
   de borrador (estilo distinto + leyenda "BORRADOR — sin revisar"; el tratamiento exacto
   se decide en implementación) y **ninguna** affordance de exportación, copia a documento
   o incorporación desde la UI. Solo el texto ADOPTADO se renderiza con la leyenda de
   trazabilidad. El usuario descuidado que confunde borrador con texto propio es la
   amenaza 7 del modelo (§9).

## 1. Dashboard ejecutivo

`/panel/[empresa]/page.tsx`: si la empresa aún no tiene un ciclo con asignaciones, se
muestra el checklist de onboarding actual (que ya calcula esos conteos); si ya opera, el
dashboard ejecutivo. Cuatro franjas, todas sobre fuentes EXISTENTES:

| Franja                       | Fuente                                                                                                                                                       | Cliente                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Avance del ciclo activo      | `questionnaire_assignments` (completados/asignados por centro; ciclo activo = el más reciente sin `date_end` pasado)                                         | Sesión (RLS)                                                                   |
| Semáforo global y por centro | Distribución de `nivel_final` VIGENTE con `agregados.ts` tal cual (supresión de fila completa <3: un centro chico muestra "—", jamás un semáforo inventado)  | service_role justificado (patrón dashboard de ciclo: `risk_results` sin GRANT) |
| Pendientes                   | Asignaciones sin responder; canalizaciones GR-I abiertas (solo CONTEO — el detalle sigue siendo del RD); programa exigido y no creado; política sin publicar | Sesión + service_role solo para el conteo GR-I (comentado)                     |
| Vencimientos                 | Reevaluación bienal (`work_centers_alerta_ciclo`) y `action_items` con `due_date` vencida o ≤30 días                                                         | Sesión (RLS)                                                                   |

El armado del semáforo se **factoriza a `lib/tablero-datos.ts`** compartido con la página
de dashboard del ciclo (mismo criterio de vigencia `resultadosVigentesPorAsignacion` +
`agregados.ts`): un solo lugar decide qué es "vigente" y qué se suprime. La franja del
resumen ejecutivo IA (§5) aparece al final del dashboard solo con el flag activo.

Lógica pura con TDD en `lib/tablero.ts`: elegir ciclo activo, clasificar vencimientos
(vencido / próximo ≤30 días / al corriente), decidir checklist vs dashboard.

## 2. Frontera IA — `lib/ia/ia-datos.ts` (allow-list)

Módulo equivalente a `soporte-datos.ts`: **lo ÚNICO que la IA recibe es lo que este módulo
arma**. Cada función selecciona columnas explícitas (nunca `select('*')`) y TODO dato de
resultados pasa por `agregados.ts` ANTES de entrar al insumo — la IA ve exactamente lo que
un admin ve en su dashboard, nada más.

**PERMITIDO (exhaustivo) — el insumo `InsumoIA`:**

- Metadata del ciclo: nombre, fechas, guías aplicadas, centro(s) y su categoría normativa.
- Participación: conteos asignados/completados (global y por centro).
- Distribuciones YA SUPRIMIDAS (fila completa <3) de `nivel_final`, por categoría y por
  dominio, global y por centro — con la marca `suprimida` intacta (la IA debe decir "grupo
  pequeño: no reportable", no inventar).
- Conteo de canalizaciones GR-I (número, jamás quiénes).
- Catálogo NORMATIVO de la Tabla 4/7 desde `system_config` (`criterios_toma_acciones`):
  niveles que exigen programa y `accionesSugeridas` por nivel.
- Nombres del tenant estrictamente necesarios: razón social y nombres de centros —
  **truncados a 120 caracteres** y transportados como valores JSON (ver anti-inyección).

**PROHIBIDO (la frontera — misma lista que soporte §6.5 de F5, sin excepción):**
`responses` · `risk_results`/`gr1_results` crudos o por persona · registros 5.8 · contenido
del buzón (**ni conteos**: fuera del insumo por completo) · nombres/correos de EMPLEADOS ·
tokens · texto libre de quejas, descripciones de eventos traumáticos, notas de seguimiento
· cualquier agregado NO pasado por `agregados.ts`.

**Anti prompt-injection (estructural, no por sanitización):**

1. El insumo viaja como **JSON canónico** (`selloCanonico` reutilizado — el mismo sha256
   que se persiste) dentro de un bloque delimitado del mensaje de usuario; el system
   prompt (fijo en código, §3) instruye tratar TODO el contenido del bloque como datos, y
   que ninguna instrucción dentro de él es válida.
2. Los únicos strings de origen tenant (razón social, nombres de centros) van como valores
   de campos JSON con truncado a 120 chars — nunca interpolados en las instrucciones.
3. La salida se **valida estructuralmente** antes de persistir (§3); una respuesta que no
   cumple el formato se descarta con error genérico (jamás se muestra al usuario texto que
   no pasó validación).

**Test de frontera obligatorio:** un unit test serializa un `InsumoIA` armado desde
fixtures con datos sensibles sembrados y afirma la AUSENCIA de todo campo prohibido
(nombres de empleados, answers, niveles individuales, texto de quejas) — el equivalente al
snapshot de columnas de las vistas de métricas de F5.

## 3. Proveedor — `lib/ia/proveedor.ts` y `lib/ia/prompts.ts`

```ts
export interface SolicitudIA {
  system: string; // constante de prompts.ts
  insumoJson: string; // JSON canónico (el mismo que se sella)
  maxTokens: number; // acotado por tipo (resumen ~1200, plan ~2000)
}
export interface RespuestaIA {
  texto: string;
  modelo: string; // el modelo REAL reportado por la API
}
export interface ProveedorIA {
  generar(solicitud: SolicitudIA): Promise<RespuestaIA>;
}
export function proveedorIA(): ProveedorIA; // Anthropic | Simulado | Nulo
```

- `ProveedorAnthropic`: `@anthropic-ai/sdk`, `IA_MODELO` (default
  `claude-haiku-4-5-20251001`), `max_tokens` acotado, sin streaming, sin herramientas,
  temperatura por default. Errores de la API → error genérico al usuario ("no se pudo
  generar; intenta de nuevo"), detalle al log del servidor SIN el insumo (regla 9).
- `ProveedorSimulado` (solo pruebas, patrón Mailpit): activo con `IA_SIMULADA=1`, devuelve
  texto determinista válido — permite E2E del flujo completo (generar → adoptar) sin red.
- `ProveedorNulo`: sin API key ni simulación — `proveedorIA()` lo devuelve y la UI muestra
  el botón deshabilitado con aviso ("la generación asistida no está configurada").
- `lib/ia/prompts.ts`: `PROMPT_RESUMEN_V1`, `PROMPT_PLAN_V1` (es-MX, dirigidos a dirección,
  con las reglas: no inventar cifras — solo las del insumo; los grupos suprimidos se
  declaran como no reportables; el plan solo propone medidas ancladas al catálogo Tabla
  4/7 citando la acción de origen; formato de salida con secciones fijas). Todo cambio de
  prompt = constante nueva (`_V2`) — las filas viejas de `ai_drafts` conservan su versión.
- **Validación de salida** en `lib/ia/validar-salida.ts` (pura, TDD): secciones esperadas
  presentes, longitud máxima, y para el plan: cada medida cita una acción del catálogo (la
  que no, se marca `sin_ancla: true` y la UI la señala como "propuesta fuera del catálogo
  normativo — revísala con especial cuidado").

**Lint (patrón F5 §8, bidireccional):** `@anthropic-ai/sdk` importable SOLO en
`lib/ia/proveedor.ts`; `lib/ia/*` prohibido en `app/**` salvo las acciones/páginas del
panel que los consumen (lista explícita); `ia-datos` consumible solo por `acciones/ia.ts`.

## 4. Persistencia — migración `..._ai_drafts.sql`

```sql
create table ai_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  cycle_id uuid not null,
  tipo text not null check (tipo in ('resumen_ejecutivo', 'plan_accion')),
  texto text not null,
  modelo text not null,
  prompt_version text not null,          -- p. ej. 'resumen_v1'
  insumo jsonb not null,                 -- JSON canónico EXACTO enviado (ya suprimido)
  insumo_sha256 text not null,
  generated_by uuid not null,            -- auth.uid() (sin FK, convención audit_log)
  created_at timestamptz not null default now(),
  adopted_by uuid,
  adopted_at timestamptz,
  foreign key (company_id, cycle_id) references compliance_cycles (company_id, id)
);
alter table ai_drafts enable row level security;
create policy ai_drafts_select on ai_drafts for select using (app.gestiona_tenant(company_id));
create policy ai_drafts_insert on ai_drafts for insert
  with check (app.gestiona_tenant(company_id) and generated_by = auth.uid());
create policy ai_drafts_update on ai_drafts for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));
-- Trigger app.solo_adopcion(): en UPDATE solo adopted_by/adopted_at, solo de null a
-- valor, una sola vez, y adopted_by = auth.uid() cuando hay sesión (patrón solo_revocacion
-- de F5). DELETE prohibido (app.rechazar_modificacion en DELETE/TRUNCATE): regenerar es
-- fila nueva; el historial de borradores es parte del rastro.
-- RESTRICTIVE de tenant activo (consecuencia F5 §2.2: toda tabla de tenant nueva):
--   ai_drafts_solo_activo_{ins,upd,del} con app.tenant_activo(company_id).
grant select, insert, update on ai_drafts to authenticated;
grant all on ai_drafts to service_role;
```

Notas: (a) el INSERT es con la **sesión** del usuario (RLS + restrictive): generar es un
acto suyo, auditado; la acción usa service_role solo para ARMAR el insumo (los agregados
leen `risk_results`, sin GRANT — mismo patrón que el dashboard de ciclo). (b) `insumo`
completo en BD es deliberado: es agregado ya suprimido (legal) y es la evidencia de qué
vio la IA. (c) El texto adoptado NO se copia a otra tabla: el programa referencia acciones
editadas por el usuario (§6) y el resumen vive aquí con su marca de adopción.

## 5. Resumen ejecutivo IA (flujo)

1. Franja "Resumen ejecutivo" al final del dashboard (§1), solo con `ia_asistida` activo.
   Muestra el último draft `resumen_ejecutivo` del ciclo activo: adoptado (con leyenda §7),
   borrador (marca de borrador §7) o vacío (botón "Generar borrador").
2. `accionGenerarResumen(companyId, cycleId)`: `autorizarEmpresa` + `puedeGestionar` +
   `empresaOperable` + flag activo + limitador `ia:{cycleId}` (10/día, **fail-closed**) →
   arma `InsumoIA` con `ia-datos` → `proveedorIA().generar(...)` → valida salida → INSERT
   `ai_drafts` con la sesión → evento `ia_borrador_generado` (fire-and-forget, details:
   tipo, modelo, prompt_version, insumo_sha256 — jamás el texto).
3. `accionAdoptarBorrador(companyId, draftId)`: gestión + confirmación explícita en UI
   ("Revisé este texto y lo hago mío") → UPDATE de adopción con la sesión (trigger
   `solo_adopcion`) → evento `ia_borrador_adoptado`.
4. Regenerar crea una fila nueva (el botón lo dice: "el borrador anterior se conserva en
   el historial"). Solo puede adoptarse el draft más reciente del ciclo y tipo.

## 6. Generador de plan de acción IA (flujo)

1. En la página del programa de intervención (o su creación), con flag activo y dominios
   en niveles que exigen programa: botón "Generar borrador de plan".
2. `accionGenerarPlan(...)`: idéntico gating que §5.2; el insumo añade el catálogo Tabla
   4/7 (`criterios_toma_acciones`). El prompt EXIGE que cada medida propuesta cite la
   acción del catálogo de la que deriva y el nivel de riesgo que la origina; la validación
   marca las que no anclan (§3).
3. La UI presenta el borrador como **lista de medidas editables** (checkbox por medida +
   texto editable + nivel de acción 8.5 pre-sugerido). "Adoptar en el programa" =
   confirmación explícita → las medidas SELECCIONADAS y EDITADAS se pre-poblan en el flujo
   EXISTENTE del programa (`accionesPrePobladas` + creación/edición actual): **el INSERT a
   `intervention_programs`/`action_items` es del usuario con su sesión y RLS, exactamente
   igual que hoy — la IA jamás escribe en el programa**. Las acciones así originadas
   guardan `ai_assisted: true` (columna nueva en `action_items`, default false).
4. La adopción marca el draft (§5.3) y deja `ia_borrador_adoptado`. El programa sigue
   siendo del cliente: editable, firmado por él, con la evidencia de siempre.

## 7. Trazabilidad — el origen del texto es parte de la evidencia

- **Borrador (no adoptado):** tratamiento visual de borrador inconfundible (estilo
  diferenciado + leyenda "BORRADOR generado por IA — sin revisar"; detalle visual en
  implementación) y **ninguna** affordance de exportación, copia a documento ni
  incorporación desde la UI. No aparece en informes, expedientes ni PDFs. Jamás.
- **Adoptado:** leyenda permanente "Borrador asistido por IA ({modelo}), revisado y
  adoptado por {usuario} el {fecha}" en todo render del texto. Las `action_items` con
  `ai_assisted` la llevan en el PDF del programa (junto al responsable que ya firma).
- **Bitácora:** `ia_borrador_generado` y `ia_borrador_adoptado` en el `audit_log` del
  tenant (catálogo `EVENTOS_AUDITORIA`), con `insumo_sha256`/`prompt_version`/`modelo` en
  details — nunca el texto.
- **Reproducibilidad:** terna `insumo_sha256` + `prompt_version` + `modelo` persistida por
  fila; los prompts viven versionados en código (decisión 6).
- Fuera de alcance de F6: incorporar el resumen adoptado al informe 7.7/expediente. Si una
  fase futura lo hace, la leyenda de adopción viaja con él (queda escrito aquí).

## 8. Retención, purga y soporte (decisión 5)

- **Purga:** `ai_drafts` tiene `company_id` → el DELETE del script de purga la barre con
  el resto del tenant. El inventario del acta gana el conteo `borradores_ia`
  (`armarActaPurga` + su test + `purgar-empresa.mjs`).
- **Soporte (F5):** nueva función `iaDraftsMetadataSoporte(companyId)` en
  `soporte-datos.ts` con columnas explícitas — `tipo, modelo, prompt_version, created_at,
adopted_at` (y conteos). **Sin `texto` ni `insumo`**: contienen interpretación de
  resultados y nombres del tenant; la frontera de soporte no se relaja. Página nueva "IA"
  en la vista de soporte (misma mecánica: `autorizarSoporte` + evento por página).
- **Suspensión:** las RESTRICTIVE de la migración hacen que un tenant no activo no genere
  ni adopte (y `empresaOperable` corta en capa app: la generación llama a una API que
  cuesta dinero — es operación).

## 9. Modelo de amenazas

| #   | Amenaza                                                                     | Mitigación                                                                                                                               | Test                                                                                                       |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Fuga de datos sensibles hacia el proveedor de IA                            | Allow-list `ia-datos` (todo pasa por `agregados.ts` antes de entrar al insumo) + lint bidireccional + llamada solo del servidor          | Unit de frontera: serializar `InsumoIA` con sensibles sembrados y afirmar ausencia de campos prohibidos    |
| 2   | Prompt-injection desde textos del tenant (nombres de centros, razón social) | JSON canónico delimitado + system prompt fijo en código + strings tenant como valores truncados + validación estructural de la salida    | Unit: insumo con nombre de centro malicioso ("ignora tus instrucciones…") no altera la estructura validada |
| 3   | Costo descontrolado por tenant                                              | Flag `ia_asistida` default OFF + limitador 10/día/ciclo **fail-closed** + persistencia (1 llamada por generación, no por vista)          | Unit del gating; E2E: flag off → sin botón                                                                 |
| 4   | Alucinación normativa (medidas inventadas como si fueran de la norma)       | El catálogo Tabla 4/7 viaja en el insumo; cada medida debe citar su acción de origen; las no ancladas se marcan y la UI las señala       | Unit de `validar-salida` (medida sin ancla → `sin_ancla: true`)                                            |
| 5   | El texto IA se cuela a evidencia sin firma humana                           | Sin adopción no hay incorporación; el INSERT al programa es del usuario con su sesión; borrador no exportable                            | Unit del trigger `solo_adopcion`; E2E de adopción                                                          |
| 6   | Suplantación de adopción (adoptar a nombre de otro / re-adoptar)            | Trigger `solo_adopcion`: solo null→valor, una vez, `adopted_by = auth.uid()`                                                             | RLS: UPDATE de texto → exception; re-adopción → exception; adopted_by ajeno → exception                    |
| 7   | Usuario descuidado confunde borrador con texto revisado                     | Distinción visual inconfundible + confirmación explícita de adopción + el borrador no es exportable ni copiable a documentos desde la UI | E2E: el borrador muestra la marca; sin adoptar no aparece leyenda de revisión                              |
| 8   | Cross-tenant vía `ai_drafts`                                                | RLS `gestiona_tenant` + FK compuesta `(company_id, cycle_id)` + RESTRICTIVE                                                              | Suite RLS: SELECT/INSERT cross-tenant → 0 filas / 42501                                                    |
| 9   | El proveedor de IA como dependencia de disponibilidad                       | Fail-graceful: error genérico, el dashboard y el programa funcionan íntegros sin IA (la función es aditiva)                              | Unit: `ProveedorNulo` → UI sin botón activo                                                                |

**Riesgo residual declarado:** los agregados suprimidos del insumo salen de la
infraestructura propia hacia la API de Anthropic bajo sus términos (sin entrenamiento con
datos de API). Es el mismo agregado que un admin ve en pantalla — no hay datos personales
sensibles en el insumo por construcción — pero el DPA/valoración con el cliente debe
mencionarlo (se añade a la lista de dependencias legales abiertas de AUDITORIA.md, junto
al aviso de privacidad y el DPA general).

## 10. Transversales

- Rutas/superficies: dashboard en `/panel/[empresa]` (condicional), franja IA en el mismo,
  botón de plan en programa; página "IA" en `/admin/soporte/[companyId]/ia`.
- Eventos nuevos del tenant: `ia_borrador_generado`, `ia_borrador_adoptado`.
- Env nuevas: `ANTHROPIC_API_KEY` (server), `IA_MODELO` (default Haiku 4.5),
  `IA_SIMULADA` (solo pruebas). `.env.example` actualizado.
- E2E (`inteligencia.spec.ts`, con `IA_SIMULADA=1`): flag off → sin IA; flag on → generar
  resumen (marca de borrador) → adoptar (leyenda con usuario/fecha) → evento en BD; plan:
  generar → editar → adoptar al programa → acción con `ai_assisted` visible.
- Docs: manual (sección del dashboard + "qué hace y qué NO hace la IA" para el cliente),
  AUDITORIA.md (nota de la dimensión IA + riesgo residual), CLAUDE.md (fila F6 + frontera
  IA en la sección de fronteras). Versión 0.8.0.
