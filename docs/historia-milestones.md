# Historia de milestones

Bitácora detallada de lo construido en cada milestone. Extraída de `CLAUDE.md` para no
cargarla en el contexto de cada sesión: el estado vigente y los pendientes vivos siguen en
`CLAUDE.md` §5. Aquí queda el detalle de lo ya cerrado, por si hace falta reconstruir por qué
algo quedó como quedó.

## M0 — Init repo, monorepo, CLAUDE.md, CI, Supabase local

✅ Cerrado. `supabase start` verificado en local (2026-07-12); `[analytics]` deshabilitado en
config.toml — en Windows Logflare exige el daemon de Docker por TCP y tumbaba todo el arranque.

## M1 — Motor de cálculo + suite de validación (antes de cualquier UI)

🟡 Cerrado para desarrollo: casos 1–11 verdes, cobertura 100% líneas / 97% ramas. PENDIENTE:
captura manual de los 2 casos mixtos en Evalúa035 (tablas listas en `reference-cases/README.md`)
y validación de lanzamiento con casos del consultor.

## M2 — Base de datos, multi-tenancy y auth (RLS + tests de aislamiento)

✅ Cerrado: 4 migraciones reproducibles, RLS + grants mínimos en 18 tablas de tenant, triggers
de inmutabilidad y nom_category, hook company_id, suite de aislamiento (36 tests) verde como
gate de CI. PENDIENTE_CONFIRMAR: conteo de preguntas GR-I por sección (6/2/7/5) al cargar
textos oficiales.

## M3 — Flujo del empleado (primera UI) + captura inmutable

✅ Cerrado: enlace tokenizado → consentimiento (versión/timestamp/IP) → filtros → cuestionario
por secciones con guardado incremental → cálculo síncrono → resultado propio. E2E Playwright
verde en las tres guías (condicionales, reconexión, expiración, notificación RD auditada).

## M4 — Panel administrativo

✅ Cerrado: auth con contraseña (@supabase/ssr) protegiendo `/panel`; alta de empresa/centros
(categoría normativa automática) y empleados (alta individual + importación CSV con reporte de
errores); ciclos con selección automática de guías y alerta de reevaluación >24 meses (numeral
7.9); distribución con enlaces tokenizados y recordatorios que rotan el token; dashboard
agregado (distribuciones/conteos, jamás promedios, supresión n<3); vista GR-I de canalizaciones
y acceso individual exclusivos del Responsable Designado con evento `individual_result_access`
auditado en cada consulta; sugerencias de acciones (Tabla 7) para niveles medio+; política de
prevención (Storage privado + acuse del empleado) y capacitación. E2E Playwright verdes: ciclo
completo del Admin de Organización y aislamiento del Consultor entre empresas.

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

## M5 — Informe 7.9 y expediente de inspección

✅ Cerrado: informe normativo 7.9 en PDF (@react-pdf/renderer; secciones a–g del numeral:
centros, método/guías, distribuciones global/categoría/dominio con supresión n<3 visible como
"— (n<3)", resumen GR-I, conclusiones deterministas —Cap. 8 considera niveles de
categoría/dominio—, acciones, evaluador, fechas) y expediente de inspección en ZIP (jszip) con
manifiesto sha256 por archivo, política de prevención (o marca explícita "ausente"; fallo de
descarga aborta, jamás miente), CSVs de proceso —acuses, participación, acciones Tabla 7,
capacitación, resumen de auditoría— en UTF-8 con BOM, sin ningún dato de resultados por
empleado. Acciones de servidor con autorización de gestión, doble filtro de tenant, INSERT-only
a `compliance_reports` y auditoría (`informe_generado`/`expediente_generado`/
`informe_descargado`) vía helper compartido `lib/auditoria.ts`. UI en pestaña "Informes y
expediente" del ciclo con historial descargable (signed URL 60s, respaldo si el navegador
bloquea el popup). Unit tests verdes + E2E `informes.spec.ts`.

## M6 — Endurecimiento y demo

✅ Cerrado: los TRES consumidores de `risk_results` (dashboard, informe 7.9, página de
acciones/Tabla 7) filtran resultados vigentes con el mismo criterio compartido
(`resultadosVigentesPorAsignacion`, genérico y exportado de `lib/informe.ts`); supresión
complementaria en `agregados.ts` (prueba de descomposición única k=1 ∨ S=k ∨ S=2k; sin celda
positiva visible se suprime todo el grupo + total; limitación residual de inferencia cruzada
documentada); CSVs del expediente neutralizan formula injection (`=`, `+`, `-`, `@`, tab, CR)
antes del entrecomillado RFC 4180; acceso individual del RD fail-closed
(`registrarAuditoriaEstricta`: sin evento `individual_result_access` registrado no se muestra el
resultado); pie del PDF con fecha es-MX; `acuses-politica.csv` identifica título/versión de la
política; seed de demo idempotente (`pnpm demo:seed`, resultados vía el motor real, protegido
contra targets no locales) + guion en `docs/demo.md`. 51 unit tests web + 59 del motor verdes.

## M7 — Manual de uso y UI premium

✅ Cerrado: `docs/manual.md` (cómo funciona, diagramas mermaid de flujo y secuencia validados,
guía del Administrador con formato CSV y tabla de permisos por rol derivada del código, guía del
empleado, prueba end-to-end local y FAQ) + rediseño visual completo sin tocar lógica: Inter vía
next/font, tokens de foco/contraste, shell del panel con sidebar (drawer móvil accesible), grupo
de rutas `(centrado)` para el flujo del empleado, toasts (sonner) aditivos a los alerts inline,
tablas/badges de nivel AA/estados vacíos/tiles del dashboard, flujo del empleado con cards Likert
(touch ≥44px), progreso pegajoso y resultado con jerarquía. Enlace "Acceso administrativo" en la
raíz. E2E 10/10 verificados localmente en cada tarea de UI.

## F1.5 — Remediación de críticos de la auditoría v0 (`docs/AUDITORIA.md`)

✅ Cerrado (2026-07-13): corrección normativa GR-II 18–19 (motor 0.2.0; recálculo 0.1.0
verificado NO aplicable), textos oficiales de los 138 ítems con gate de CI, supresión de fila
completa anti-reidentificación, expiración del token antes que "completado" + consulta auditada,
guardas de escritura (`lib/escrituras.ts`), confirmación de correo obligatoria + contraseñas 12+,
aviso de privacidad versionado en BD + canal ARCO público, CSP con nonce/HSTS/XFO, catálogo
tipado de `event_type`, errores de formulario visibles + `error.tsx`/`not-found.tsx`, validación
de subidas por magic bytes, diálogo de confirmación accesible con conteo de correos, foco visible

- contrastes AA. Mapa hallazgo→commit y deuda abierta reconocida en `docs/AUDITORIA.md`.
  Validación: motor 59/59, web 59/59, RLS 38/38, E2E 10/10, 12 migraciones desde cero.

## F2 — Sistema de diseño e identidad **Constata**

✅ Cerrado (2026-07-13): marca Constata (elección del propietario; manual en `docs/BRAND.md`) con
logotipo/isotipo/favicon propios y `title.template`; design tokens en `@theme` (marca azul
profundo, semáforo por nivel con AA, semánticos de interfaz; cero paleta cruda en componentes);
librería UI (Button con `cargando`, CampoTexto/CampoSelect con error ligado, TablaDatos con
búsqueda/orden/paginación, Modal base del DialogoConfirmacion, EmptyState con contrato
qué/por qué/CTA, Tabs, Breadcrumbs, Skeleton); login dividido con propuesta de valor; navegación
(empresa activa + selector multi-tenant, pestañas del ciclo en layout compartido, migas, footer
legal, checklist de primer uso); copy es-MX de las 25 filas de la auditoría (parcial: plantilla
CSV descargable); correos con `plantillaCorreo` (escape de HTML, `MAIL_FROM` obligatorio en
producción); a11y: drawer con foco gestionado, skip link, guardado anunciado, scroll-padding.
Mapa hallazgo→commit en `docs/AUDITORIA.md` (Remediación Fase 2). Validación: motor 59/59, web
66/66, RLS 38/38, E2E 10/10.

## F2.5 — Endurecimiento estructural

✅ Cerrado (2026-07-13): el panel opera como el usuario (cliente de sesión + RLS real;
`service_role` solo justificado y con guardia de lint), resultados individuales sin GRANT para
`authenticated` (ni el RD los lee fuera de la app auditada), membresía real sustituye al claim
del JWT (multi-empresa y alta reciente funcionan), guardia explícita del rol miembro, limitador
de tasa en BD (ARCO 5/h/IP, tokens inválidos 30/10min/IP, acciones por token 2,500/h, GoTrue
10/5min/IP), anti-bot Turnstile (registro/login/ARCO; sin llaves no se exige), MFA TOTP opcional
con enforcement aal2 (página Seguridad), plantilla CSV descargable, `th scope` completo,
`.env.example`; `loading.tsx` intentado y revertido (Router Cache servía contenido viejo tras
mutaciones — ver convención). Suite RLS 38→46. Validación: motor 59/59, web 73/73, RLS 46/46,
E2E 10/10.

## F3 — Configurabilidad

✅ Cerrado (2026-07-13): mini-fase (idempotencia de recordatorios/informes con el limitador,
designación de RD con confirmación + aviso a otros admins — no se prohíbe: empresa unipersonal —,
caducidad de sesión 168h/12h con VigiaSesion); **cuestionarios personalizados** (catálogo por
tenant APARTE de las guías intocables: definition JSONB, borrador→publicado inmutable sellado
sha256→archivado, nueva versión = fila nueva, editor con vista previa móvil que usa el
renderizador real del empleado, respuesta por `/encuesta/[token]` con límites, reporte agregado
con supresión <3, `custom_answers` sin GRANT); configuración de organización (logo PNG/JPEG por
magic bytes junto a la marca en el PDF, zona horaria, contacto); plantillas de correo editables
con {{variables}} + escape obligatorio + restaurar (correo de acuse nuevo); recordatorios
automáticos cada N días (cron `/api/cron/recordatorios` con CRON_SECRET, idempotente por bitácora

- limitador) y fecha límite visible; feature flags por organización (lectura tenant, escritura
  solo plataforma). Suite RLS 46→50, E2E 11/11 (spec nuevo del editor), web 94/94, gate
  `verificar:textos` verde.

## F4 — Ciclo normativo completo

✅ Cerrado (2026-07-14): base normativa verificada contra el DOF (spec con transcripción literal
de 5.7/7.7-7.9/8.1-8.5/PEC 10.2 y Tablas 4/7).

- **Difusión de resultados** (5.7 e / 7.8): constancia por ciclo — instantánea agregada con
  supresión n<3 en lenguaje llano, sellada sha256 sobre JSON canónico (`selloCanonico`
  compartido), append-only versionada; vista previa del panel = render EXACTO del trabajador;
  consulta y acuse "Enterado" desde el enlace del cuestionario SOLO tras enviar (no sesga el
  instrumento).
- **Buzón de quejas** (8.1 b): token por EMPRESA (anonimato técnicamente real; token en claro en
  BD porque es enlace de difusión obligatoria 5.7 d), queja anónima o identificada a elección
  explícita, folio QJ- + clave (solo hash en BD; la consulta devuelve solo metadatos), estados
  con nota obligatoria (`complaint_events` append-only, 8.2 g); el CONTENIDO tiene estándar de
  resultado individual: `complaints` sin GRANT, lectura solo con `queja_consultada` fail-closed,
  trigger `queja_solo_estado`, limitadores buzon 5/h/IP y buzon-folio 30/10min/IP.
- **Programa de intervención** (8.3/8.4/8.5): exigido si algún vigente (Cfinal/categoría/dominio)
  cae en medio+, criterios LITERALES de la Tabla 4/7 en `system_config`, creación guiada con
  acciones pre-pobladas editables, campos 8.4 (áreas sujetas, responsable, evaluación posterior),
  nivel de acción 8.5, evidencia por acción (PDF/imagen magic bytes + sha256, bucket
  `evidencias`), documento PDF con los 6 incisos.
- **Expediente completo**: INDICE.txt primera entrada (descripción + sha256 + ausencias
  DECLARADAS), instrumentos aplicados sellados por guía, constancia de difusión byte-verificable
  contra su sello + acuses CSV, programa PDF + avances CSV, buzón agregado (solo conteos por
  categoría/estado/mes).

9 eventos de auditoría nuevos. Suite RLS 50→58, E2E 15/15 (spec `ciclo-normativo`), web 120/120.
