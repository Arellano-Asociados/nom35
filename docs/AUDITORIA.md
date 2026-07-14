# Auditoría integral — Plataforma NOM-035

**Fecha:** 12 de julio de 2026 · **Commit auditado:** `v0-baseline` (`0c6ccf6`, main) · **Modo:** solo lectura, sin modificar código.

**Equipo auditor:** diseño de producto senior · auditoría de accesibilidad WCAG 2.2 AA · ingeniería de seguridad de aplicaciones (AppSec + LFPDPPP) · consultoría NOM-035-STPS-2018 · staff engineering.

**Alcance:** 69 archivos fuente de `apps/web/src` y `packages/motor-nom035/src`, 9 migraciones SQL, configuración (`next.config.ts`, `supabase/config.toml`, CI), scripts y documentación. Los hallazgos citan `archivo:línea`.

---

## Resumen ejecutivo

La plataforma tiene **una arquitectura de evidencia y un motor de cálculo superiores a la práctica de mercado**: inmutabilidad impuesta por triggers de base de datos, auditoría fail-closed del acceso a datos individuales, expediente con manifiesto SHA-256, aislamiento multi-tenant con llaves foráneas compuestas, y un motor normativo puro con verificación por transcripción independiente. Ese esqueleto es correcto y es lo difícil de construir.

**Y sin embargo, hoy el producto no puede usarse en producción.** No por los defectos sutiles, sino por tres bloqueadores visibles:

1. **Los cuestionarios no tienen las preguntas.** Los textos de los 138 ítems son marcadores de posición: un trabajador ve literalmente `ITEM_TEXT_PENDIENTE_23`. Ninguna evaluación aplicada así tiene validez normativa, y todo lo que se construye encima (informe, dashboard, expediente) es evidencia de un proceso que no ocurrió.
2. **El nivel de riesgo individual se filtra al patrón.** La supresión anti-reidentificación oculta el _conteo_ pero no el _atributo_: con un solo respondiente, el dashboard —y el informe que se entrega a la STPS— muestran `Nulo 0 · Bajo 0 · Medio <3* · Alto 0 · Muy alto 0`. El nivel de esa persona queda expuesto, y el padrón de empleados permite identificarla. Rompe dos reglas inviolables del producto.
3. **Hay una discrepancia de cálculo sin resolver en la GR-II** que, de confirmarse, subcalifica una categoría completa en todos los centros de 16–50 trabajadores.

La buena noticia: **los tres tienen remediación acotada** y ninguno exige rearquitectura. Lo que falta es, literalmente, la carne normativa y una capa de rigor en los bordes (errores silenciosos, privacidad de los agregados, accesibilidad del cuestionario).

### Veredicto por audiencia

| Pregunta                                                                | Respuesta                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Un inspector de la STPS aprobaría a una empresa que usó esta app?      | **No.** Los cuestionarios no contienen las preguntas oficiales; faltan tres piezas del ciclo (difusión de resultados, buzón de quejas, Programa de intervención del 8.4). |
| ¿Aguantaría una revisión de la autoridad de datos personales?           | **No.** El aviso de privacidad es un texto de relleno, su contenido no se archiva (solo la etiqueta "v1"), no hay canal de derechos ARCO y no hay política de retención.  |
| ¿Un trabajador con discapacidad motriz puede responder su cuestionario? | **No.** El foco de teclado es invisible en las opciones de respuesta.                                                                                                     |
| ¿Parece un producto por el que una empresa pagaría?                     | **Todavía no.** El favicon es el de Next.js y los SVG de `create-next-app` siguen ahí.                                                                                    |
| ¿La base técnica es sólida?                                             | **Sí.** Motor, inmutabilidad, tenancy y auditoría son de calidad alta y bien probados.                                                                                    |

### Conteo de hallazgos

| Dimensión                    | Crítico | Alto   | Medio  | Bajo   |
| ---------------------------- | ------- | ------ | ------ | ------ |
| 1. UX/UI                     | 2       | 2      | 5      | 2      |
| 2. Copy y mensajes           | 1       | 3      | 4      | 3      |
| 3. Identidad corporativa     | 0       | 2      | 4      | 1      |
| 4. Navegación y AI           | 0       | 3      | 2      | 2      |
| 5. Accesibilidad             | 1       | 3      | 7      | 5      |
| 6. Seguridad y LFPDPPP       | 2       | 9      | 5      | 3      |
| 7. Notificaciones y feedback | 0       | 2      | 3      | 0      |
| 8. Gráficas y reportes       | 0       | 0      | 2      | 1      |
| 9. Cumplimiento NOM-035      | 2       | 3      | 4      | 4      |
| 10. Código y deuda técnica   | 1       | 5      | 5      | 3      |
| **Total**                    | **9**   | **32** | **41** | **24** |

---

## Remediación — Fase 1.5 «críticos» (2026-07-13, rama `fase-1.5-criticos`)

Esta sección se añadió al cerrar la Fase 1.5; el resto del documento conserva el texto
original de la auditoría como registro histórico. Validación al cierre de la fase:
lint + typecheck sin warnings, motor 59/59, web 59/59 (unit), suite RLS 38/38, E2E
Playwright 10/10, migraciones 12/12 reproducibles desde cero.

| Hallazgo                                                                 | Commit    | Estado                                                                                                        |
| ------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------- |
| C-01 · Textos oficiales de los 138 ítems + gate de CI                    | `15ab189` | ✅ Cerrado (firma del consultor pendiente → deuda abierta)                                                    |
| C-02 · GR-II ítems 18–19 puntúan en su categoría (motor 0.2.0)           | `c447f87` | ✅ Corregido motor+seed+tests (validación externa pendiente → deuda abierta)                                  |
| C-02 · Recálculo de resultados 0.1.0                                     | `37fc798` | ✅ Verificado: NO aplica (no hay ningún resultado real 0.1.0; solo eran fixtures RLS)                         |
| C-03 · Fuga del atributo: se enmascara la fila completa                  | `b24ab29` | ✅ Cerrado (inferencia temporal → deuda abierta)                                                              |
| C-04 · Escrituras que tragaban el error (9 mutaciones, `lib/escrituras`) | `5839791` | ✅ Escrituras cerradas (lecturas de página fail-silent → deuda abierta)                                       |
| C-05 · Errores de formulario visibles (`?error=` + `<ErrorFormulario>`)  | `d530eea` | ✅ Cerrado                                                                                                    |
| C-05 · `error.tsx` y `not-found.tsx` en es-MX                            | `4f81300` | ✅ Cerrado (`loading.tsx` pendiente → deuda abierta)                                                          |
| C-06 · Foco visible en las opciones del cuestionario                     | `a03e7f8` | ✅ Cerrado (incluye contrastes AA: quick wins 1 y 12)                                                         |
| C-07 · Aviso de privacidad real, versionado en BD con sha256             | `7c03a15` | ✅ Base técnica cerrada (texto = plantilla; revisión de abogado + DPA → deuda abierta)                        |
| C-08 · Canal ARCO público + `arco_requests` (plazo 20 días hábiles)      | `7c03a15` | ✅ Canal cerrado (retención/bloqueo/disociación → deuda abierta)                                              |
| C-09 · Marca (favicon, logo, plantilla de correo)                        | —         | ❌ Abierto deliberadamente: es trabajo de identidad (Fase 2), no de seguridad                                 |
| [Alto] Resultado del empleado visible para siempre + sin auditar         | `51ee5f1` | ✅ Cerrado (expiración primero + evento `resultado_propio_consultado`; quick win 3)                           |
| [Alto] Email squatting del consultor + contraseñas de 6                  | `58ae94b` | ✅ Cerrado (confirmación obligatoria, `email_confirmed_at`, 12+composición, autocomplete; quick wins 6 y 13a) |
| [Alto] Cero validación de archivos subidos                               | `e75ee43` | ✅ Cerrado (magic bytes, 10 MB, nombre del servidor, en política y capacitación; quick win 10)                |
| [Alto] Distribuir/recordatorios sin confirmación previa                  | `4c26946` | ✅ Cerrado (diálogo accesible con «Se enviarán N correos» y aviso de rotación de enlaces; quick win 11)       |
| [Alto] `event_type` sin tipar (bitácora fragmentable)                    | `774dc1b` | ✅ Cerrado (catálogo `as const` + union; también migra `gr1_notificacion_dr` al helper; quick win 14)         |
| [Medio] Sin cabeceras de seguridad                                       | `176d377` | ✅ Cerrado (CSP con nonce + strict-dynamic, HSTS, X-Frame-Options, nosniff, Referrer-Policy; quick win 7)     |
| [Medio] `accionAcusarPolitica` aceptaba tokens vencidos                  | `5839791` | ✅ Cerrado                                                                                                    |
| [Medio] Capacitación sin `accept` en el input                            | `d530eea` | ✅ Cerrado                                                                                                    |

Quick wins cerrados: 1, 2, 3, 4, 5, 6 (sin captcha), 7, 8 (sin `loading.tsx`), 9, 10,
11, 12, 13 (autocomplete; los 2 `role="alert"` siguen pendientes), 14. Abierto: 15 (marca).

## Remediación — Fase 2 «diseño» (2026-07-13, rama `fase-2-diseno`)

Sistema de diseño e identidad **Constata** (nombre elegido por el propietario;
manual en `docs/BRAND.md`). Cierra las dimensiones 1–4 y el resto de accesibilidad.
Validación al cierre: lint + typecheck sin warnings, motor 59/59, web 66/66 (unit),
RLS 38/38, E2E 10/10.

| Hallazgo                                                                                             | Commit                | Estado                                                                                              |
| ---------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------- |
| C-09 · Marca: nombre Constata, logotipo/isotipo, favicon, fuera scaffold                             | `5520bbe`             | ✅ Cerrado (correos con marca en `7cf7072`)                                                         |
| §3 [Medio] `title` estático → `title.template` por página                                            | `5520bbe`             | ✅ Cerrado                                                                                          |
| §3 [Medio] Paleta sin sistema → design tokens `@theme` (marca/semáforo/UI)                           | `eb7efc1`             | ✅ Cerrado                                                                                          |
| §3 [Medio] Correos sin plantilla ni marca · remitente de relleno                                     | `7cf7072`             | ✅ Cerrado (`plantillaCorreo` + `MAIL_FROM` obligatorio en producción + escape de HTML)             |
| §3 [Bajo] Sin footer, versión ni enlaces legales                                                     | `f836f02`             | ✅ Cerrado                                                                                          |
| §1 [Alto] Subpáginas del ciclo pierden la navegación · sin estado activo                             | `f836f02`             | ✅ Cerrado (Tabs en `ciclos/[ciclo]/layout.tsx` con `aria-current`)                                 |
| §1 [Alto] Selects vacíos sin salida (empleados, ciclos)                                              | `e1e5248`             | ✅ Cerrado (EmptyState con CTA a Centros)                                                           |
| §1 [Medio] Dashboard sin estado vacío                                                                | `e1e5248`             | ✅ Cerrado                                                                                          |
| §1 [Medio] Lista de empleados sin buscador ni paginación                                             | `cea31fd` + `e1e5248` | ✅ Cerrado (TablaDatos: búsqueda sin acentos, orden, paginación)                                    |
| §1 [Medio] Fechas ISO crudas                                                                         | `f836f02`             | ✅ Cerrado (`lib/fechas.ts` es-MX con suite)                                                        |
| §1 [Medio] Capacitación sin tamaño máximo comunicado                                                 | `e1e5248`             | ✅ Cerrado ("solo PDF, máximo 10 MB" visible; validación de servidor desde Fase 1.5)                |
| §1 [Bajo] Orden ilógico del select de nivel · §1 [Bajo] `CardTitle` h2 fijo                          | `e1e5248` / `cea31fd` | ✅ Cerrados                                                                                         |
| §2 Copy (las 25 filas)                                                                               | `e1e5248` + `7cf7072` | ✅ Cerrado salvo la plantilla CSV descargable (fila 4, parcial: instrucciones en términos de Excel) |
| §4 [Alto] Cero onboarding                                                                            | `e1e5248`             | ✅ Cerrado (checklist de primer uso en `/panel/[empresa]` con porqué normativo y CTA)               |
| §4 [Alto] Sin breadcrumbs · §4 [Medio] pestañas sin estado activo                                    | `f836f02`             | ✅ Cerrado (migas en el ciclo, la profundidad señalada)                                             |
| §4 [Alto] Sidebar sin empresa activa ni cambio de empresa                                            | `f836f02`             | ✅ Cerrado (bloque "Empresa activa" + selector multi-tenant)                                        |
| §4 [Bajo] Pestañas restringidas sin enlace a la solución                                             | `e1e5248`             | ✅ Cerrado (enlace a Equipo para designar RD)                                                       |
| Login: primera pantalla de demo                                                                      | `5827600`             | ✅ Layout dividido con propuesta de valor (elección del propietario)                                |
| §5 [Alto] Drawer móvil sin gestión de foco                                                           | `d6ffd9c`             | ✅ Cerrado (dialog + trampa de Tab + restauración de foco)                                          |
| §5 [Medio] Skip link · header pegajoso tapa el foco · guardado no anunciado · progressbar sin nombre | `d6ffd9c`             | ✅ Cerrados (WCAG 2.4.1 / 2.4.11 / 4.1.3 / 4.1.2)                                                   |
| §5 [Medio] Errores sin `aria-invalid`/`aria-describedby` · 2 sin `role=alert`                        | `cea31fd` + `e1e5248` | ✅ Cerrados (CampoTexto/CampoSelect + quick win 13 completo)                                        |
| §5 [Bajo] Tablas del resultado sin `overflow-x-auto`                                                 | `d6ffd9c`             | ✅ Cerrado                                                                                          |
| §2 fila 5 / §9 jerga al trabajador ("Cuestionario GR-III")                                           | `d6ffd9c`             | ✅ Cerrado ("Cuestionario sobre tu entorno de trabajo")                                             |

Sigue abierto de estas dimensiones: plantilla CSV descargable (fila 4), `loading.tsx`,
`<th scope>` en las tablas de distribución heredadas, y todo lo estructural de las
fases 3–4 del plan. _(Actualización: los tres primeros se cerraron/resolvieron en la
Fase 2.5, abajo.)_

## Remediación — Fase 2.5 «endurecimiento estructural» (2026-07-13, rama `fase-2.5-hardening`)

Plan de migración fuera de `service_role` aprobado por el propietario y ejecutado
completo. Validación al cierre: lint (con guardia nueva) + typecheck, build, motor
59/59, web 73/73 (unit), **RLS 46/46** (creció de 38), E2E 10/10.

| Hallazgo                                                                                                 | Commit                | Estado                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §10 [Alto] El panel entero opera con `service_role`: RLS no protege sus rutas                            | `c3eef6d`             | ✅ Cerrado: páginas y acciones de gestión con `clienteSesion()` (RLS real); `service_role` solo justificado y comentado; guardia de lint que impide colar `supabase-admin` en `app/panel/**`                         |
| Regla 5 endurecida: el RD podía leer resultados directo por la API REST (sin auditoría)                  | `9054ee6`             | ✅ Cerrado: revoke de SELECT/UPDATE en `risk_results`/`gr1_results` a `authenticated` — mismo patrón que `responses`                                                                                                 |
| Claim `company_id` del JWT como condición (rompía al creador recién registrado y al admin multi-empresa) | `c3eef6d`             | ✅ La membresía real por `auth.uid()` es la única fuente de verdad; un claim manipulado sigue sin abrir nada                                                                                                         |
| §6 [Medio] El rol `miembro` ve todo el tenant                                                            | `c3eef6d`             | ✅ Cerrado: guardia explícita en páginas de gestión + RLS por debajo; el RD navega en solo lectura                                                                                                                   |
| §6 [Alto] Fuerza bruta viable: ningún límite en la aplicación                                            | `97485e6`             | ✅ Cerrado: limitador de ventana fija en BD (solo `service_role`), GoTrue 10/5min/IP, ARCO 5/hora/IP, tokens inválidos 30/10min/IP, acciones por token 2,500/hora                                                    |
| §6 Captcha comentado (quick win 6, parte pendiente)                                                      | `97485e6`             | ✅ Cerrado: Turnstile (no invasivo) en registro/login y ARCO; sin llaves no se exige (dev/E2E)                                                                                                                       |
| §6 [Alto] Sin MFA                                                                                        | `b594f1d`             | ✅ Cerrado: TOTP opcional nativo (página Seguridad, QR + código) con enforcement aal2 en el panel                                                                                                                    |
| §2 fila 4: plantilla CSV descargable                                                                     | `21fa3f0`             | ✅ Cerrado                                                                                                                                                                                                           |
| §5 [Bajo] `<th scope>` en tablas heredadas                                                               | `21fa3f0`             | ✅ Cerrado (WCAG 1.3.1 completo)                                                                                                                                                                                     |
| `.env.example` documentando el entorno                                                                   | `21fa3f0`             | ✅ Cerrado                                                                                                                                                                                                           |
| `loading.tsx` del panel                                                                                  | `21fa3f0` → `d7fd567` | ⚠️ Intentado y revertido con causa verificada: el Router Cache del cliente servía contenido viejo tras mutaciones con redirect a la misma ruta (el empleado recién creado no aparecía). Queda en deuda con el porqué |

## Remediación — Fase 3 «configurabilidad» (2026-07-13, rama `fase-3-config`)

Mini-fase (remates de deuda 2.5) + configurabilidad. Validación al cierre: lint +
typecheck, build, motor 59/59, web 94/94 (unit), **RLS 50/50**, **E2E 11/11** (nuevo
spec del editor), gate `verificar:textos` verde (las 3 guías oficiales intactas).

| Entregable                                                                                                                                                     | Commit    | Estado                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| §6 [Medio] Recordatorios/informes sin límite ni idempotencia                                                                                                   | `0e13c5c` | ✅ Cerrado: 1/10min por ciclo (recordatorios) y 1/5min (informe/expediente) con el limitador de BD                                                    |
| §6 [Alto] Auto-designación de RD sin control                                                                                                                   | `0e13c5c` | ✅ Cerrado (evaluado: NO se prohíbe — empresa unipersonal del segmento —; confirmación explícita + bitácora + correo a los demás admins)              |
| §6 [Alto] Sin caducidad de sesión                                                                                                                              | `0e13c5c` | ✅ Cerrado: timebox 168h + inactividad 12h + VigiaSesion (aviso y regreso al login; el cuestionario del empleado guarda incremental y no pierde nada) |
| Feature flags por organización (terreno para planes)                                                                                                           | `0346f14` | ✅ BD bajo RLS, escritura solo plataforma, evaluación en servidor, default sensato                                                                    |
| Cuestionarios personalizados (editor, previa móvil real, publicado inmutable sellado sha256, versionado, respuesta por token, reporte simple sin semáforo/7.9) | `820c8ca` | ✅ Guías oficiales intocables (gate verde); `custom_answers` sin GRANT (patrón `responses`)                                                           |
| Configuración de organización (logo validado junto a la marca, zona horaria, contacto en informes)                                                             | `b995120` | ✅ `validarImagen` por magic bytes (SVG rechazado: HTML ejecutable)                                                                                   |
| Plantillas de comunicación editables ({{variables}}, escape obligatorio, vista previa, restaurar)                                                              | `b995120` | ✅ Correo de acuse nuevo; envíos reales cableados                                                                                                     |
| Parámetros de ciclo: recordatorios automáticos cada N días + fecha límite visible                                                                              | `b995120` | ✅ Cron idempotente con CRON_SECRET; decide por bitácora; reusa el módulo del botón manual                                                            |

## Remediación — Fase 4 «ciclo normativo completo» (2026-07-13, rama `fase-4-ciclo-normativo`)

Cierra los tres [Alto] de la dimensión 9 que bloqueaban aprobar una inspección (difusión de
resultados, buzón de quejas, Programa de intervención) y completa el expediente. Base
normativa verificada contra el DOF (spec en
`docs/superpowers/specs/2026-07-13-fase-4-ciclo-normativo-design.md`). Validación al
cierre: lint + typecheck, build, motor 59/59, web 120/120 (unit), **RLS 58/58**
(creció de 50), **E2E 15/15** (spec nuevo `ciclo-normativo.spec.ts`).

| Hallazgo                                                                        | Commit                | Estado                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §9 [Alto] No existe difusión de resultados a los trabajadores (5.7 e / 7.8)     | `5c589ce`→`788f1af`   | ✅ Constancia por ciclo: instantánea agregada (supresión n<3 + fila completa) en lenguaje llano, sellada sha256, append-only y versionada; acuse "Enterado" por token                                                       |
| §9 [Alto] No hay mecanismo de quejas por violencia laboral (8.1 b)              | `6021067`→`e636370`   | ✅ Buzón por empresa sin sesión (token de difusión obligatoria), anonimato real a elección explícita, folio+clave (solo hash en BD), estados con nota (8.2 g)                                                               |
| Regla 5 extendida: el contenido de una queja = estándar de resultado individual | `6021067` + `e636370` | ✅ `complaints` sin GRANT para authenticated; lectura solo en la app con `queja_consultada` fail-closed; texto libre siempre como texto plano; jamás en correos                                                             |
| §9 [Alto] Las "acciones" no son el Programa de intervención (8.3/8.4)           | `10c3683`→`e68009b`   | ✅ `intervention_programs` (áreas sujetas, responsable, evaluación posterior) + acciones con nivel 8.5, evidencia por magic bytes y avance; criterios LITERALES de la Tabla 4/7 como datos; documento PDF con los 6 incisos |
| §8 [Bajo] Expediente incompleto frente al ciclo real                            | `3ea19e4`             | ✅ `INDICE.txt` (primera entrada, sha256 por archivo, ausencias DECLARADAS), instrumentos aplicados sellados por guía, constancia de difusión byte-verificable, programa PDF+CSV, buzón agregado (solo conteos)             |
| §9 [Bajo] "Sugerencias Tabla 7" mal atribuidas                                  | `10c3683`             | ✅ Los criterios reales de la Tabla 4/7 (texto literal del DOF) gobiernan el programa; el contenido propio quedó como "sugerencias de referencia"                                                                           |

Lo que quedó abierto de la dimensión 9 al cierre de la Fase 4 lo cierra la Fase 4.5, abajo.

## Remediación — Fase 4.5 «remates normativos» (2026-07-14, rama `fase-4.5-remates`)

Cierra **toda la deuda normativa restante de la dimensión 9**. Spec en
`docs/superpowers/specs/2026-07-14-fase-4.5-remates-normativos-design.md`. Validación al
cierre: lint + typecheck, build, motor 59/59, web 129/129 (unit, creció de 120),
**RLS 64/64** (creció de 58), **E2E 19/19** (spec nuevo `eventos-ats.spec.ts`).

| Hallazgo                                                                           | Commit              | Estado                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §9 [Medio] Acontecimientos traumáticos severos solo dentro de ciclos (5.3/5.5/6.5) | `fd4df76`→`a57be4f` | ✅ `traumatic_events` append-only + sección "Eventos traumáticos": registro del hecho y aplicación de la GR-I **solo a los expuestos**. Internamente crea un ciclo ATS marcado, que reutiliza tokens/GR-I/canalización sin tocarlos y NO cuenta para la alerta bienal |
| §9 [Medio] Registro de trabajadores examinados (5.8 c) sin soporte exportable      | `fcf2040`           | ✅ CSV generado por el RD, de TODA la empresa, con columna de origen (ciclo ordinario vs. acontecimiento). Controlado por acceso —no por inexistencia—: auditoría fail-closed, sin Storage, sin correo                                                                |
| §9 Registro de resultados (5.8 a) para la autoridad                                | `fcf2040`           | ✅ CSV del RD con calificación y niveles por categoría/dominio de cada trabajador, solo resultados vigentes. Regla 5 estricta: un `individual_result_access` **por resultado incluido**; sin bitácora no hay archivo                                                  |
| §9 Informe mal numerado (era 7.9) y sin los incisos b) y c)                        | `eb78e2f`           | ✅ Informe **7.7** en toda la superficie (PDF, UI, ZIP, tipos); 7.9 se conserva solo donde significa periodicidad. Nuevos: b) Objetivo determinista por guías, c) Actividades del centro, d) método con la forma de aplicación del 7.4 b–d                            |
| §9 [Medio] Sin integración al diagnóstico de SST (7.6 / NOM-030)                   | `eb78e2f`           | ✅ Las conclusiones del informe incluyen la integración al diagnóstico de seguridad y salud (NOM-030). La integración es obligación del patrón; el informe es su insumo                                                                                               |
| §8 Expediente ciego a los acontecimientos traumáticos                              | `dbb3fc2`           | ✅ `eventos-traumaticos.csv` con solo conteos por evento; sin acontecimientos, la ausencia se **declara** en el INDICE. Sin nombres: quién requirió valoración vive en el 5.8 c) del RD                                                                               |

**Guía V (ficha sociodemográfica): no es deuda normativa.** Las guías de referencia se
declaran a sí mismas no obligatorias («El contenido de esta guía es un complemento… y no es
de cumplimiento obligatorio»). El dato «área» ya se captura; ampliar la ficha es una decisión
de producto, no un requisito. El resto de la dimensión 9 queda **cerrado**: las únicas deudas
abiertas del documento son las de dependencia externa (ver «Deuda abierta reconocida»).

## Los 9 hallazgos críticos

### C-01 · Los cuestionarios no contienen las preguntas oficiales (NOM-035 · Código)

> ✅ **Remediado** en `15ab189` (Fase 1.5): 138 textos del DOF + gate de CI. Firma del consultor pendiente — ver «Deuda abierta reconocida».

`supabase/migrations/20260711200004_seeds_normativos.sql:20-36` · Los textos de los 138 ítems (GR-I 20, GR-II 46, GR-III 72) son literales generados: `'ITEM_TEXT_PENDIENTE_' || i`. La UI del empleado renderiza `questions.text` tal cual (`lib/flujo.ts:102-111` → `components/responder/cuestionario.tsx:131`), de modo que el trabajador ve `23. ITEM_TEXT_PENDIENTE_23`.

**Impacto:** los numerales 7.4 y 7.5 exigen aplicar los cuestionarios de las Guías de Referencia **o** un instrumento con validez psicométrica demostrada. Un cuestionario con reactivos falsos no es ninguno de los dos: la identificación y análisis de factores de riesgo **nunca se realizó**. Todo lo demás —cálculo, dashboard, informe, expediente— es evidencia de un proceso inexistente. La perfección del motor es irrelevante si el estímulo mostrado al trabajador no es la pregunta.

**Estado:** era un pendiente reconocido en M2 ("al cargar textos oficiales") y los milestones M3–M7 se cerraron encima sin resolverlo, hasta dejar de aparecer como bloqueante en las listas.

**Remediación:** migración con los textos literales del DOF (incluidos los encabezados de los ítems condicionales y la instrucción de responder pensando en los dos últimos meses) + **gate de CI que falle si existe `questions.text LIKE 'ITEM_TEXT_PENDIENTE%'`**. Esfuerzo: M (transcripción cuidadosa + revisión del consultor).

### C-02 · Discrepancia de cálculo en la GR-II: ítems 18 y 19 — **requiere verificación inmediata**

> ✅ **Remediado** en `c447f87` (Fase 1.5): la Tabla 3 del DOF confirma que 18–19 SÍ puntúan; motor 0.2.0 + migración. Recálculo de resultados 0.1.0 verificado NO aplicable (`37fc798`). Validación externa del consultor pendiente — ver «Deuda abierta reconocida».

`packages/motor-nom035/src/datos/gr2.ts:51-65` · `supabase/migrations/20260711200004_seeds_normativos.sql:116-124` · `packages/motor-nom035/src/datos.test.ts:188-193`

El código excluye deliberadamente los ítems 18 y 19 de la categoría _Factores propios de la actividad_ (sí los cuenta en el dominio y en la Cfinal), con un comentario que lo atribuye al DOF: _"la categoría … NO puntúa los ítems 18 y 19 … así lo define el DOF"_. El test lo consagra como verdad normativa.

**El auditor NOM-035, contrastando contra el PDF oficial de la STPS, sostiene lo contrario:** en la Tabla 3 la dimensión _"Limitada o nula posibilidad de desarrollo"_ (ítems 18–19) pertenece al dominio _Falta de control sobre el trabajo_, que pertenece a esa categoría; y el numeral II.3 b) 2) define la calificación de la categoría como la suma de **los ítems que la integran**, sin excluir ninguno.

**No es posible resolverlo desde el código: son dos transcripciones que se contradicen.** Se documenta como crítico _con verificación requerida_, no como defecto confirmado.

**Impacto si se confirma la excepción:** en todos los centros de 16–50 trabajadores la calificación de esa categoría queda subcalificada hasta en 8 puntos sobre rangos de 10/20/30/40 — trabajadores en riesgo Medio/Alto pueden reportarse un nivel por debajo, y un perito que recalcule un solo cuestionario a mano detecta la inconsistencia y descalifica la evidencia completa.

**Remediación:** esto es exactamente lo que zanja la **validación cruzada pendiente desde M1** (casos resueltos por consultor certificado + verificación contra Evalúa035, hoy con `reference-cases/` vacío y el test en modo `todo`). Ejecutarla es ahora la prioridad número uno del motor. Si se confirma el error: corregir motor + seed + test, subir versión del motor y **recalcular con `supersedes_id`** (el mecanismo de recálculo inmutable ya existe y funciona).

### C-03 · Fuga del nivel de riesgo individual: la supresión oculta el conteo, no el atributo (Seguridad · NOM-035)

> ✅ **Remediado** en `b24ab29` (Fase 1.5): si alguna celda se suprime, se enmascara la fila completa (ceros y total incluidos). La inferencia temporal sigue abierta — ver «Deuda abierta reconocida».

`apps/web/src/lib/agregados.ts:35-44, 85-117` · `components/panel/tabla-distribucion.tsx:31-45` · `informes/informe-79-pdf.tsx:148-158` — **verificado a mano contra el código.**

`celda()` suprime el conteo cuando `0 < n < 3`, pero **la celda conserva su etiqueta de nivel y las celdas en cero se pintan como `0 (0%)`**. Con un único respondiente en el grupo consultado, la tabla queda:

```
Nulo 0 (0%)  ·  Bajo 0 (0%)  ·  Medio [<3 *]  ·  Alto 0 (0%)  ·  Muy alto 0 (0%)
```

El valor está oculto; **el nivel no**. La supresión complementaria añadida en M6 oculta el _total_ en este caso, lo cual no protege nada: los ceros ya revelan que todos los demás niveles están vacíos.

**Cadena de explotación, ejecutable por un Admin de Organización o un Consultor** —precisamente los roles a los que las reglas inviolables 4 y 5 prohíben ver resultados individuales:

1. `empleados/page.tsx:51-62` le entrega el padrón con **nombre + área**.
2. `ciclos/[ciclo]/page.tsx:126-136` ("Progreso por área") le dice **cuántos completaron por área** → sabe cuándo un área tiene un solo respondiente.
3. `dashboard/page.tsx:73-76` permite **filtrar la distribución por área**.
4. La tabla le revela el nivel de riesgo psicosocial de esa persona, con nombre y apellido.

Ni siquiera hace falta un área pequeña: basta consultar el dashboard sin filtro **justo después de que responda la primera persona del ciclo**. El mismo defecto se imprime en el **informe 7.9 que se entrega a la STPS**.

**Hallazgo relacionado [Alto] — ataque diferencial temporal:** el dashboard es `force-dynamic` y se recalcula en vivo (`dashboard/page.tsx:11`). Un admin que lo consulte antes y después de cada respuesta obtiene distribuciones que difieren en exactamente una persona: `nulo=5` ayer, `nulo=6` hoy ⇒ conoce el nivel de quien respondió en ese lapso. La supresión `n<3` no protege contra esto en absoluto. El código documenta con honestidad la inferencia _entre tablas_, pero la inferencia _en el tiempo_ nunca se consideró.

**Remediación:** cuando alguna celda de una fila se suprima, **suprimir la fila completa** (todas las celdas, incluidos los ceros, y el total). Publicar ceros junto a una única celda enmascarada equivale a publicar el valor. Además: umbral mínimo de respondientes por vista (no renderizar distribuciones con `total < 5`), bloquear el filtro por área cuando el área tenga menos de N respondientes, y **congelar los agregados en instantáneas** en vez de recalcular en vivo (mata el ataque temporal). Esfuerzo: S–M.

### C-04 · Pérdida silenciosa de evidencia: ~63 de 92 consultas descartan el error (Código)

> ✅ **Remediado (escrituras)** en `5839791` (Fase 1.5): `lib/escrituras.ts` aplicado a las 9 mutaciones. Las lecturas de página fail-silent siguen abiertas (Fase 4).

El patrón `const { data } = await supabase.from(...)` —sin revisar `{ error }`— aparece en **~63 de las ~92 llamadas de producción**. Cuatro casos comprometen directamente la evidencia legal:

| Acción                 | Línea                           | Qué pasa                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accionAcusarPolitica` | `acciones/responder.ts:150-155` | El insert a `policy_acknowledgments` no se revisa: **el empleado ve "listo" y el acuse puede no haberse guardado**. Es evidencia de difusión ante la STPS.                                                                      |
| `accionDesignarmeRD`   | `acciones/panel.ts:170-186`     | El `UPDATE` no se revisa, pero el evento `rd_designado` se escribe en la bitácora igual: **la auditoría puede afirmar que hay RD designado cuando el flag sigue en false**. Auditoría que miente es peor que auditoría ausente. |
| `accionCrearEmpresa`   | `acciones/panel.ts:41-45`       | Si falla el insert de `role_assignments`, queda una empresa **sin ningún miembro** y el usuario rebota a `/panel`.                                                                                                              |
| `accionSubirPolitica`  | `acciones/panel.ts:512-517`     | Revisa el error de la subida, pero no el del insert a `policies`: **archivo huérfano en Storage y política inexistente** para acuses y expediente, con redirect de éxito.                                                       |

Además, **15 páginas del panel renderizan "vacío" ante un fallo de base de datos**: un error de conexión se ve idéntico a "nadie ha contestado". En un producto donde se toman decisiones y se archiva evidencia según lo que muestra la pantalla, esa distinción importa.

**Remediación:** revisar `{ error }` en las 9 escrituras (S, unas horas), y un helper `datosObligatorios()` que lance en lecturas de página para que un `error.tsx` lo capture (M).

### C-05 · Los errores de 6 formularios nunca se muestran al usuario (UX)

> ✅ **Remediado** en `d530eea` (`<ErrorFormulario>` + `searchParams`) y `4f81300` (`error.tsx`/`not-found.tsx` es-MX). `loading.tsx` pendiente (Fase 2).

Las acciones redirigen con `?error=datos|crear|subida` (`acciones/panel.ts:61, 229, 254, 461, 503, 510, 533, 540`) pero **las páginas destino no leen `searchParams`**: `centros`, `ciclos`, `politica`, `capacitacion`, `acciones` no lo hacen, y `empleados/page.tsx:106` solo contempla `duplicado`.

**Consecuencia concreta:** si falla la subida del PDF de la política —una tarea normativa clave— la página se recarga sin decir absolutamente nada y **el admin cree que publicó**. Combinado con C-04, el fallo es doblemente invisible.

Agravante: **no existe ni un solo `loading.tsx`, `error.tsx` ni `not-found.tsx`** en toda la app (verificado: cero archivos). Un error de servidor muestra la pantalla default de Next **en inglés**; una navegación lenta no muestra nada y el usuario hace doble clic.

**Remediación:** componente `<ErrorFormulario codigo={error}>` con diccionario de mensajes + `searchParams` en las 6 páginas; `error.tsx`, `not-found.tsx` y `loading.tsx` con la marca y en es-MX. Esfuerzo: S.

### C-06 · El foco de teclado es invisible en las respuestas del cuestionario (Accesibilidad)

> ✅ **Remediado** en `a03e7f8` (Fase 1.5): `has-focus-visible:` en los labels de cuestionario y filtros, más contrastes AA.

`components/responder/cuestionario.tsx:147-154` y `filtros.tsx:36-43` · **WCAG 2.4.7 Foco visible (AA)**

El `<input type="radio">` real lleva `className="sr-only"`: el anillo de foco global se dibuja sobre un elemento recortado de 1×1 px, es decir, **no se ve nada**. El `<label>` tipo tarjeta no tiene ningún estilo de foco. Las flechas mueven el foco (los radios siguen siendo nativos), pero sin indicador visual alguno.

**A quién excluye:** un trabajador con discapacidad motriz que navega por teclado o conmutador —exactamente el público que la NOM-035 busca proteger— debe recorrer hasta **360 opciones de respuesta sin ver jamás dónde está el foco**. En la práctica, no puede completar su cuestionario de forma autónoma.

**Remediación:** una clase por label: `has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600`. Esfuerzo: XS. **Es el arreglo con mejor relación impacto/esfuerzo de toda la auditoría.**

### C-07 · El aviso de privacidad es un texto de relleno, y su contenido no se archiva (LFPDPPP)

> ✅ **Remediado (base técnica)** en `7c03a15` (Fase 1.5): `privacy_notices` append-only con sha256, `consents` apunta a la fila exacta, render desde BD. El texto es plantilla base: requiere abogado + DPA — ver «Deuda abierta reconocida».

`components/responder/consentimiento.tsx:33-47` · `acciones/panel.ts:36` · `supabase/migrations/20260711200002_tablas_tenant.sql:174-185`

Dos fallos encadenados sobre el mismo punto:

**(a) El aviso no es un aviso.** Está hardcodeado en un componente React y consiste en tres frases genéricas. Le falta prácticamente todo lo que exigen los arts. 8, 15, 16 y 17 LFPDPPP: identidad y **domicilio del responsable**, **enumeración de los datos** recabados (incluida la IP, que ni se menciona), **finalidades primarias y secundarias** diferenciadas, **transferencias** y destinatarios, **medios para ejercer derechos ARCO**, **mecanismo de revocación** y remisión al aviso integral. Sobre ese texto se está recabando el **consentimiento expreso para datos sensibles de salud** (art. 9): un consentimiento otorgado sobre un aviso inválido es impugnable, y con él se cae el pilar probatorio del producto.

**(b) El texto no se conserva.** `consents` guarda `privacy_text_version`, `accepted_at` e `ip`, pero `privacy_notice_version` se fija literalmente a `'v1'` al crear la empresa y **no existe ninguna tabla que almacene el contenido versionado**. El texto vive en el JSX y cambia con cada despliegue sin que la etiqueta cambie. Ante un litigio, la plataforma puede acreditar _que_ el trabajador aceptó "v1" el día X desde la IP Y, pero **no qué decía "v1"**. El `git blame` de un componente no es evidencia oponible.

**Remediación:** aviso redactado con asesoría legal, cargable y versionado **por cada empresa cliente** (ella es la responsable; la plataforma es encargada); tabla `privacy_notices (company_id, version, texto, sha256, published_at)` append-only referenciada por `consents`; el componente renderiza desde BD, nunca desde código. Esfuerzo: M.

### C-08 · Ausencia total de derechos ARCO (LFPDPPP)

> ✅ **Remediado (canal)** en `7c03a15` (Fase 1.5): página pública `/privacidad` + `arco_requests` con plazo de 20 días hábiles. Retención/bloqueo/disociación abiertos — ver «Deuda abierta reconocida».

Búsqueda exhaustiva en `apps/web/src`: **no existe nada**. Ni pantalla, ni endpoint, ni correo de contacto, ni proceso documentado para que el trabajador ejerza Acceso, Rectificación, Cancelación u Oposición (arts. 22–34 LFPDPPP). Lo único que el titular puede ver es su propio resultado, y solo mientras conserve su enlace.

La ley obliga al responsable a designar persona/departamento de datos personales y a atender solicitudes en **20 días hábiles**. La ausencia total es un incumplimiento directo y sancionable, independiente de cualquier vulnerabilidad técnica.

**Tensión legal real que hay que resolver (no es un descuido, es un diseño sin salida):** `responses`, `risk_results`, `consents` y `audit_log` son append-only por trigger, y **no existe ninguna ruta de borrado, bloqueo, anonimización ni caducidad**. El art. 26 admite negar la cancelación cuando hay obligación legal de conservación (la NOM-035 la tiene), así que el append-only es _defendible mientras dure esa obligación_ — pero el art. 11 exige **suprimir** los datos cumplida la finalidad, con una fase previa de **bloqueo**. Hoy la obligación de conservar se usa de facto como licencia para conservar para siempre, que es justo lo que la ley no permite.

**Remediación:** canal ARCO con registro auditado; periodo de retención definido con asesoría legal; **bloqueo** (marcar fila como bloqueada y negar su lectura, sin romper el append-only) y **disociación** posterior (romper el vínculo `employee_id` conservando el agregado y el hash). La inmutabilidad del _contenido_ y la supresión del _vínculo con la persona_ son perfectamente compatibles; simplemente no se ha diseñado esa salida. Esfuerzo: M–L.

### C-09 · El nombre del producto no es marca, y la app se ve de fábrica (Identidad)

> ✅ **Remediado** en la Fase 2 (`5520bbe`, `7cf7072`, `5827600`): marca **Constata** (docs/BRAND.md), logotipo e isotipo propios, favicon, `title.template`, correos con plantilla y remitente obligatorio, y login con propuesta de valor. Quick win 15 cerrado. (El marcador de la tabla de la Fase 1.5 se conserva como registro histórico de aquel corte.)

`apps/web/src/app/favicon.ico` (el ícono default de Next.js, 25 KB sin tocar) · `apps/web/public/{next,vercel,globe,file,window}.svg` (los assets de `create-next-app`, intactos) · sin logo en ningún punto: la marca es el string "Plataforma NOM-035" (`sidebar.tsx:44`).

Es el hallazgo más barato de arreglar de toda la auditoría y **lo primero que ve un prospecto**: la pestaña del navegador de un producto de cumplimiento que se vende a consultoras muestra el logo de Next.js. Añádase que los correos salen sin plantilla ni marca y, si falta `MAIL_FROM`, **desde `noreply@example.com`** (`lib/correo.ts:68`) — indistinguible de phishing y con destino directo a spam.

Se clasifica como crítico no por riesgo técnico sino por **viabilidad comercial**: bloquea cualquier demo a cliente.

---

## 1. UX/UI

Además de C-05 (errores invisibles y ausencia de boundaries):

- **[Alto] Las subpáginas del ciclo pierden la navegación.** Las 5 pestañas (Dashboard/Acciones/GR-I/Individual/Informes) viven solo en `ciclos/[ciclo]/page.tsx:76-84`; no hay `layout.tsx` compartido. Una vez dentro de una subsección **no hay forma de saltar a otra** salvo el botón "atrás". Tampoco marcan la sección activa (el sidebar sí lo hace, `sidebar.tsx:56-67`). → Mover el `<nav>` a `ciclos/[ciclo]/layout.tsx` con `aria-current`.
- **[Alto] Selects vacíos sin salida.** Si la empresa no tiene centros, el `<select name="centro" required>` de `empleados/page.tsx:88-95` y `ciclos/page.tsx:87-93` se renderiza **vacío**: el formulario no puede enviarse y nada le dice al usuario "primero crea un centro". → Estado vacío con enlace directo a Centros.
- **[Medio] El dashboard no tiene estado vacío.** Con cero resultados muestra tiles en "0" y tres tablas de ceros, sin explicar que faltan cuestionarios por responder. Es el único hueco: el resto de las listas sí lo tienen (`campos.ts:10-11`).
- **[Medio] Lista de empleados sin buscador ni paginación** (`empleados/page.tsx:47-48`, `max-h-96 overflow-y-auto`). Para el segmento objetivo declarado (101–500 empleados) es una caja de scroll inmanejable.
- **[Medio] Fechas ISO crudas en la UI** (`ciclos/page.tsx:65-67` "inicia 2026-07-12", `gr1/page.tsx:72`). Solo `generar-informe.tsx:186` formatea en es-MX. → Helper único.
- **[Medio] Densidad inconsistente** entre listas equivalentes: `px-4 py-3` (centros) vs `px-3 py-2` (empleados) vs otro tratamiento (ciclos).
- **[Medio] La subida de capacitación acepta cualquier archivo** sin `accept` (política sí lo tiene) y ninguna comunica el tamaño máximo.
- **[Bajo] Orden ilógico del select de nivel** en `acciones/page.tsx:146-150`: Medio, Alto, Muy alto, _Bajo, Nulo_.
- **[Bajo] `CardTitle` siempre emite `<h2>`** (`card.tsx:17-19`), aplanando la jerarquía de encabezados.

## 2. Copy y mensajes

Tres problemas sistémicos: **(a)** los códigos normativos internos (`GR-I`, `Cfinal`, `Cap. 8`, `SHA-256`) se muestran sin traducir; **(b)** los errores diagnostican pero no orientan; **(c)** valores crudos de BD llegan a pantalla (`en_progreso`, `gr1_gr3`, mensajes de Supabase **en inglés**).

| #   | archivo:línea                                | Texto actual                                                                        | Problema                                                                | Propuesta                                                                                                                                    |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `acciones/panel.ts` y `informes.ts` (8 usos) | "Sin permisos"                                                                      | No dice qué permiso ni qué hacer                                        | "Tu rol no permite esta acción. Pídele al Administrador de la organización que la realice o que te asigne el permiso."                       |
| 2   | `ingresar/page.tsx:35`                       | "No se pudo crear la cuenta: ${r.error?.message}"                                   | Filtra el mensaje de Supabase **en inglés**                             | Mapear: "Ya existe una cuenta con este correo. Usa '¿Ya tienes cuenta? Ingresa'."                                                            |
| 3   | `acciones/panel.ts:140`                      | "${email}: ${error.message}"                                                        | Error de PostgREST en inglés, visible en el reporte del CSV             | "ana@empresa.mx: no se pudo registrar (revisa el correo y el formato de la fila)"                                                            |
| 4   | `importador-csv.tsx:26-28`                   | "Formato: `nombre,email,area,atiende_clientes,supervisa_personal` (banderas si/no)" | Jerga de base de datos; RH no "pega CSVs", abre Excel                   | "Copia desde Excel las columnas: Nombre, Correo, Área, ¿Atiende clientes? (sí/no), ¿Supervisa personal? (sí/no)" + **plantilla descargable** |
| 5   | `responder/[token]/page.tsx:150`             | "Cuestionario GR-III"                                                               | El trabajador no sabe qué es "GR-III"                                   | "Cuestionario sobre tu entorno de trabajo (NOM-035)"                                                                                         |
| 6   | `acciones/panel.ts:324`                      | Asunto: "Cuestionario NOM-035 (GR-III)"                                             | Código interno en el asunto de un correo masivo                         | "Te invitamos a responder tu cuestionario NOM-035 — [Empresa]"                                                                               |
| 7   | `acciones/panel.ts:392`                      | "Este enlace sustituye al anterior:"                                                | Advertencia técnica sin explicación                                     | "Aún no has respondido. Usa este nuevo enlace (los anteriores ya no funcionan):"                                                             |
| 8   | `dashboard/page.tsx:152`                     | Fila "Cfinal"                                                                       | Nombre de variable del motor en la UI                                   | "Calificación final"                                                                                                                         |
| 9   | `generar-informe.tsx:177`                    | Columna "SHA-256"                                                                   | Hash críptico sin explicación                                           | "Huella de integridad" + "Código que permite demostrar que el archivo no fue alterado"                                                       |
| 10  | `ciclos/[ciclo]/page.tsx:53`                 | "Acciones (Cap. 8)"                                                                 | Abreviatura normativa                                                   | "Acciones correctivas" (subtítulo: "Capítulo 8 de la NOM-035")                                                                               |
| 11  | `acciones/page.tsx:97`                       | `{a.status}` → "en_progreso"                                                        | Valor de BD con guion bajo                                              | Diccionario (el patrón ya existe en `badges.tsx:53-57`)                                                                                      |
| 12  | `centros/page.tsx:46`                        | Fallback `?? c.nom_category` → "gr1_gr3"                                            | Enum crudo si falta en el diccionario                                   | "Categoría no determinada"                                                                                                                   |
| 13  | `acciones/panel.ts:200`                      | "No existe una cuenta con ese correo"                                               | Diagnóstico sin siguiente paso                                          | "Esa persona aún no tiene cuenta. Pídele que se registre y vuelve a intentarlo."                                                             |
| 14  | `acciones/panel.ts:432`                      | "No se pudo actualizar"                                                             | Ni qué ni qué hacer                                                     | "No se pudo guardar el cambio de canalización. Intenta de nuevo."                                                                            |
| 15  | `formulario-equipo.tsx:42`                   | "Designarme Responsable Designado"                                                  | Redundancia ("designarme designado")                                    | "Asumir el rol de Responsable Designado"                                                                                                     |
| 16  | `boton-accion.tsx:36`                        | "Listo: Distribuir cuestionarios"                                                   | Toast armado con la etiqueta del botón; suena a máquina                 | "Cuestionarios enviados a N empleados"                                                                                                       |
| 17  | `consentimiento.tsx:73`, `filtros.tsx:93`    | "Ocurrió un error"                                                                  | Vacío de significado, en el flujo del trabajador                        | "No pudimos guardar tu respuesta. Revisa tu conexión e intenta de nuevo."                                                                    |
| 18  | `politica.tsx:50`                            | "Error"                                                                             | Una sola palabra                                                        | "No se pudo registrar tu acuse. Intenta de nuevo."                                                                                           |
| 19  | `acciones/responder.ts:104`                  | "Este ítem no aplica según tus preguntas filtro"                                    | "Ítem" y "preguntas filtro" son jerga del motor                         | "Esta pregunta no aplica para tu puesto."                                                                                                    |
| 20  | `gr1/page.tsx:44`                            | "Canalizaciones GR-I (valoración clínica requerida)"                                | Doble jerga                                                             | "Trabajadores que requieren valoración clínica (Guía I)"                                                                                     |
| 21  | `acciones/panel.ts:326`                      | Correo de invitación                                                                | No dice cuánto tarda, ni que es confidencial, ni cuándo vence (60 días) | Añadir duración, "nadie de tu empresa puede ver tus respuestas" y fecha de vencimiento                                                       |
| 22  | `panel/nueva/page.tsx:15` vs `:32`           | "Registrar empresa" / botón "Crear empresa"                                         | Inconsistencia registrar/crear                                          | Unificar                                                                                                                                     |
| 23  | `ciclos/page.tsx:40`                         | "Atención (numeral 7.9): …"                                                         | Cita normativa antes que la consecuencia                                | "El centro X no se ha evaluado en más de 24 meses: la NOM-035 exige una nueva evaluación."                                                   |
| 24  | `ingresar/page.tsx:77`                       | "Un momento…"                                                                       | El resto usa "Procesando…"/"Guardando…"                                 | Unificar el verbo de espera                                                                                                                  |
| 25  | `empleados/page.tsx:118`                     | "Importación por CSV"                                                               | Sigla técnica como título                                               | "Importar lista de empleados (desde Excel)"                                                                                                  |

**Tono:** el tuteo es consistente en toda la app y las mayúsculas siguen _sentence case_. Eso está bien.

## 3. Identidad corporativa

Además de C-09:

- **[Alto] No hay logo.** La marca es texto plano; el flujo del empleado no muestra ningún identificador visual (ni de la plataforma ni de su empresa).
- **[Medio] `<title>` estático en todas las páginas** (`layout.tsx:11-14`, sin `title.template`): con varias pestañas abiertas son indistinguibles. También es un fallo WCAG 2.4.2.
- **[Medio] Paleta sin sistema:** `globals.css` solo define la fuente; el color primario está hardcodeado como `blue-700` en 15 archivos. Cambiar el color de marca hoy es buscar/reemplazar.
- **[Medio] Correos sin plantilla ni marca** y remitente de relleno (ver C-09). El CTA es un `<a>` de texto plano difícil de tocar en móvil.
- **[Medio] Nombre de producto inconsistente:** "Plataforma NOM-035" vs "Plataforma de Cumplimiento NOM-035-STPS-2018" (autor del PDF). Además "NOM-035" es descriptor de categoría, no marca registrable: todos los competidores pueden llamarse igual.
- **[Bajo] Sin footer, versión ni enlaces legales** en el shell — llamativo en un producto que trata datos sensibles.

## 4. Navegación y arquitectura de información

**Clics por tarea clave** (desde `/panel`, autenticado, una empresa):

| Tarea                    | Clics | Comentario                       |
| ------------------------ | ----- | -------------------------------- |
| Publicar la política     | 3     | Eficiente                        |
| Crear un ciclo           | 3     | Eficiente                        |
| Importar empleados       | 3     | Eficiente                        |
| Distribuir cuestionarios | 4     | Sin confirmación previa (ver §7) |
| Ver resultados agregados | 4     | Eficiente                        |
| Generar el expediente    | 6     | Razonable                        |

Las profundidades son correctas. **El problema no es el número de clics, es la orientación:**

- **[Alto] Cero onboarding.** Tras crear la empresa, el admin aterriza en Centros vacío. Nada explica la secuencia obligada (centro → empleados → política → ciclo → distribuir → dashboard → informe), y varios pasos dependen de otros (de ahí los selects vacíos). Es el momento de mayor abandono de un SaaS. → **Checklist de primer uso** en `/panel/[empresa]` con estado ✓/pendiente y enlace a cada paso; los datos para calcularlo ya se consultan.
- **[Alto] Sin breadcrumbs.** En `/panel/[empresa]/ciclos/[ciclo]/individual/[empleado]` (5 niveles) el único contexto es la razón social. Combinado con la pérdida de pestañas, se navega con el botón "atrás".
- **[Alto] El sidebar no muestra la empresa activa** ni permite cambiar de empresa (solo el clic en el wordmark, convención no descubrible). Para una **consultora que atiende varias empresas** —el diferenciador declarado del producto— no hay confirmación persistente de en qué tenant está actuando. Con URLs de UUID crudo, el riesgo de operar sobre el cliente equivocado es real.
- **[Medio] Pestañas del ciclo sin estado activo** (el sidebar sí lo tiene).
- **[Bajo] Las pestañas restringidas no enlazan a la solución:** un admin que no es RD ve el aviso de acceso restringido en GR-I sin enlace a Equipo, donde puede designarse.

## 5. Accesibilidad (WCAG 2.2 AA)

Además de C-06 (foco invisible en el cuestionario). **Contrastes calculados** con los valores oficiales de Tailwind v4:

| Combinación                       | Ratio     | ¿AA?           | Dónde                                                                                                       |
| --------------------------------- | --------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| slate-400 / blanco                | **2.63**  | ❌ (req. 4.5)  | Porcentajes de las tablas (`tabla-distribucion.tsx:40`), "Sin datos suficientes" (`dashboard/page.tsx:120`) |
| slate-500 / slate-100             | **4.35**  | ❌             | Badge suprimido "<3 *" (`badges.tsx:45`)                                                                    |
| Borde slate-200 / blanco          | **1.23**  | ❌ (req. 3.0)  | Borde de los radios tipo tarjeta sin marcar                                                                 |
| Borde slate-300 / blanco          | **1.49**  | ❌ (req. 3.0)  | Bordes de inputs (`campos.ts:7`)                                                                            |
| slate-500 / blanco                | 4.76      | ✅ (al límite) | Subtítulos, encabezados                                                                                     |
| blue-700 / blanco                 | 6.83      | ✅             | Enlaces y botón primario                                                                                    |
| Badges de nivel (bg-100/text-800) | 6.36–8.08 | ✅             | Los 5 niveles + estados                                                                                     |

- **[Alto] Porcentajes del dashboard ilegibles** (2.63:1) para baja visión — y son el dato principal del panel de resultados. → `text-slate-600`.
- **[Alto] Drawer móvil sin gestión de foco** (`sidebar.tsx:121-136`): no es `role="dialog"`, no atrapa el foco (Tab recorre el contenido tapado por el overlay), no restaura el foco al cerrar. Sí cierra con Escape y tiene `aria-expanded` — la base está.
- **[Alto] Login sin `autocomplete`** (`ingresar/page.tsx:52-69`): falla **1.3.5** y debilita **3.3.8 (Autenticación accesible)**, el criterio nuevo de 2.2 que protege a quien depende del gestor de contraseñas. → `autocomplete="email"` / `current-password` / `new-password`.
- **[Medio] El encabezado pegajoso puede tapar el elemento enfocado** (**2.4.11**, nuevo en 2.2): `cuestionario.tsx:97`, ~70 px sobre el contenido. → `scroll-padding-top: 6rem`.
- **[Medio] Sin enlace "saltar al contenido"** (2.4.1): 8+ tabulaciones para llegar al contenido en cada página del panel.
- **[Medio] Regiones con scroll no operables por teclado en Safari** (2.1.1): el más grave es el **aviso de privacidad** (`consentimiento.tsx:33`) — el texto legal que el empleado debe poder leer antes de consentir. → `tabIndex={0}` + `role="region"`.
- **[Medio] El guardado automático nunca se anuncia** (4.1.3): el estado vive solo en `data-guardando`. Un empleado ciego no sabe si su respuesta persistió —la promesa central del flujo— ni por qué "Enviar" está deshabilitado.
- **[Medio] Barra de progreso sin nombre accesible** (4.1.2): anuncia "barra de progreso 37" sin decir de qué.
- **[Medio] Errores sin `aria-invalid`/`aria-describedby`** ligados al campo (3.3.1/3.3.3), y **dos errores sin `role="alert"`** (`politica.tsx:42`, `selector-canalizacion.tsx:56`) — el primero, en el flujo del trabajador.
- **[Bajo] Tablas del resultado del empleado sin `overflow-x-auto`** (1.4.10) — el resto de la app sí lo tiene.
- **[Bajo] `<th>` sin `scope`** y encabezado de columna vacío en las tablas de distribución (1.3.1).

**Target Size (2.5.8, nuevo en 2.2): pasa** — medido: opciones de 44 px, botones 36–48 px, checkboxes envueltos en su label.

**Riesgo de exclusión por perfil:** trabajador con discapacidad motriz → **no puede completar el cuestionario** (C-06). Trabajador ciego → lo completa, pero sin confirmación de guardado. Trabajador mayor/baja visión en móvil → los bordes de los botones de respuesta (1.23:1) son casi invisibles a pleno sol.

## 6. Seguridad y LFPDPPP

Además de C-03, C-07 y C-08:

**Autorización y tenancy**

- **No se encontró IDOR cross-tenant.** Se rastreó `autorizarEmpresa()` en cada página y acción y se buscó específicamente el antipatrón `.eq('id', X)` sin `.eq('company_id', ...)`: **no existe ninguno**. Cambiar el UUID de empresa en la URL termina en `redirect('/panel')`. Las **FKs compuestas `(company_id, id)`** en toda la cadena de tenant son una defensa estructural real.
- **[Alto] Auto-designación como RD sin control** (`panel.ts:162-187`): cualquier `admin_org` se otorga el flag con un clic; la cédula es un string libre que no se valida. Ese flag es **la única barrera** entre un rol patronal y los resultados individuales de salud. El modelo asume "patronal ≠ RD", pero el producto permite que el patrón _se convierta_ en RD. Un log no es un control de acceso. → Prohibir la auto-designación; exigir un usuario distinto, aceptación del RD y notificación a los demás admins.
- **[Medio] El rol `miembro` ve todo el tenant:** 9 páginas solo llaman `autorizarEmpresa()` sin `puedeGestionar()`, así que un `miembro` sin flag RD lee el padrón completo (nombre + correo), los agregados, los ciclos y los informes. El esquema documenta que ese rol "no otorga permisos por sí mismo".

**Sesión y credenciales**

- **[Alto] Contraseñas de 6 caracteres sin requisitos, sin MFA, sin caducidad de sesión** (`supabase/config.toml:182,185,272-275,299-306`). El cliente pide 8, el servidor acepta 6. Para cuentas que acceden a datos de salud de cientos de trabajadores, es difícilmente defendible bajo el art. 19 LFPDPPP.
- **[Alto] Apropiación de cuenta de consultor por _email squatting_.** `enable_signup = true` + `enable_confirmations = false` ⇒ cualquiera crea cuenta con **cualquier correo, sin probar que es suyo**. `accionAgregarConsultor` (`panel.ts:198-205`) localiza al consultor **solo por coincidencia de correo**. Un atacante que sepa el correo del despacho que la empresa va a contratar se registra antes; cuando el Admin lo agrega, el sistema le entrega el tenant: agregados, padrón, ciclos, informes y expedientes. La víctima nunca se entera. → `enable_confirmations = true` (bloqueante) + exigir `email_confirmed_at` + invitación aceptada.
- **[Medio] Cookies de sesión legibles por JavaScript** (inherente a `createBrowserClient`), sin CSP que lo compense: cualquier XSS roba la sesión completa.

**Token del empleado**

- **[Alto] El resultado individual es visible para siempre** (`responder/[token]/page.tsx:48-71` vs `:73-81`) — **verificado a mano**: la guarda `if (ctx.completado)` **retorna el resultado antes** de comprobar `if (ctx.expirado)`. El enlace del correo —que el patrón administra— muestra el dato de salud del trabajador indefinidamente, sin caducar y **sin quedar auditado** (a diferencia del acceso del RD, que sí lo está). TI de la empresa, un buzón compartido o el historial de una máquina compartida bastan. → Evaluar `expirado` primero y caducar la vista de resultado.
- **[Medio] `accionAcusarPolitica` no valida estado ni expiración** (`responder.ts:137-139`): es la única acción que llama `obtenerContexto` en vez de `contextoActivo`. Un token vencido sigue pudiendo escribir acuses — evidencia que se exhibe ante la STPS.
- **[Bajo] Vigencia de 60 días** y token en el path de la URL (queda en logs de servidor e historial). Bien hecho: 256 bits de entropía, solo el SHA-256 en BD, rotación real en los recordatorios, y `rel="noreferrer"` en el enlace a la política.

**Subidas y almacenamiento**

- **[Alto] Cero validación de archivos** (`panel.ts:495-549`): solo se comprueba `size === 0`. Sin MIME en servidor, sin _magic bytes_, sin límite de tamaño, sin lista blanca; el `contentType` lo dicta el cliente y el nombre se concatena crudo a la clave del objeto. El `accept="application/pdf"` del `<input>` se salta con cualquier cliente HTTP. Un admin (o un consultor infiltrado por el hallazgo anterior) sube un `.html`/`.svg` declarando `text/html`, y ese archivo **se entrega a los empleados** por URL firmada desde el dominio de Supabase → XSS almacenado / phishing con URL legítima, dirigido a los trabajadores justo cuando entregan datos de salud. → Lista blanca + magic bytes + límite de tamaño + nombre generado por el servidor + `Content-Disposition: attachment`.

**Rate limiting**

- **[Alto] Fuerza bruta viable:** **no existe ningún límite en la aplicación**; el único control es el de Supabase (30 intentos/5 min **por IP**) con el captcha comentado, contra contraseñas de 6 caracteres. ~8,640 intentos diarios por IP.
- **[Medio] Recordatorios e informes sin límite ni idempotencia:** "Enviar recordatorios" en bucle = spam a toda la plantilla desde el dominio corporativo, quema de cuota de correo y **rotación continua de tokens que invalida los enlaces que los empleados ya tenían abiertos**. El límite `email_sent = 2/hora` de la config **no aplica** (ese es el correo de Supabase Auth; estas acciones usan Resend).

**Configuración**

- **[Medio] `next.config.ts` no define ninguna cabecera de seguridad** — verificado: el archivo son 8 líneas con `transpilePackages`. Faltan **CSP**, **HSTS**, **X-Frame-Options/frame-ancestors**, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. Sin `frame-ancestors`, el panel es _frameable_ → clickjacking sobre "Designarme RD" o "Distribuir".

**LFPDPPP (adicional a C-07/C-08)**

- **[Medio] Transferencias internacionales y relación responsable/encargado sin declarar:** los datos viven en Supabase y se procesan en Vercel (fuera de México salvo configuración explícita); el aviso no menciona transferencia alguna, y no hay contrato/cláusula que documente que la plataforma es **encargada** y la empresa **responsable**. Hoy la plataforma emite un aviso _en nombre de_ la empresa cliente con un texto que la empresa nunca redactó ni aprobó: expone a ambas.
- **[Medio] La IP se recolecta sin declararla, y es frágil como evidencia:** `responder.ts:32` toma el primer valor de `x-forwarded-for`, cabecera que el cliente controla. Es dato personal no declarado (arts. 6 y 16) y, al ser falsificable, su valor probatorio es débil — justo lo contrario de lo que se busca con ella.
- **[Medio] Sin procedimiento de notificación de vulneraciones** (art. 20).
- **[Bajo] Interpolación sin escapar de `full_name` en el HTML de los correos** (`panel.ts:325, 391`): inyección de HTML desde un CSV manipulado.

## 7. Notificaciones y feedback

| Acción                                                                    | Éxito                                                        | Error                 | Confirmación previa |
| ------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------- | ------------------- |
| Crear centro/empleado/ciclo/acción, publicar política, subir capacitación | **Ninguno**                                                  | **Roto** (C-05)       | —                   |
| Distribuir cuestionarios                                                  | Toast + detalle                                              | Toast + inline        | **No**              |
| Enviar recordatorios                                                      | Toast + detalle                                              | Toast + inline        | **No**              |
| Importar CSV                                                              | Toast + reporte por línea                                    | Toast + inline        | —                   |
| Generar informe/expediente                                                | Toast + refresh                                              | Toast + inline        | No                  |
| Descargar informe                                                         | Abre pestaña, con respaldo si el navegador bloquea el pop-up | Toast + inline        | —                   |
| Cuestionario (guardado incremental)                                       | **Invisible**                                                | Inline `role="alert"` | —                   |

- **[Alto] "Distribuir cuestionarios" envía correos masivos reales con un solo clic, sin confirmación.** El envío no se puede deshacer. Un clic accidental dispara la campaña.
- **[Alto] "Enviar recordatorios" invalida los enlaces anteriores sin avisarlo** (`panel.ts:377-383` rota el `token_hash`): cualquier empleado con el correo original abierto pierde el acceso. Generará tickets de "mi enlace no funciona" que RH no sabrá explicar. → Confirmación explícita en ambos botones.
- **[Medio] Los formularios clásicos no confirman el éxito:** el Toaster ya está montado, pero solo lo usan los componentes cliente. Publicar la política termina en un redirect mudo.
- **[Medio] Operaciones lentas sin progreso:** el importador CSV inserta fila por fila en serie; con 300 empleados son decenas de segundos con el botón en "Importando…" y nada más.
- **[Medio] El guardado automático no tiene señal visible** (la página promete "tus respuestas se guardan automáticamente"; el estado solo existe en un atributo `data-*`).
- **Correos faltantes:** al consultor no se le notifica que fue asignado; al admin no se le avisa cuando el ciclo llega al 100%. Y si falta `NEXT_PUBLIC_APP_URL`, el correo al RD sale con `href=""` (`flujo.ts:283`).

## 8. Gráficas y reportes

- **[OK] Semáforo y granularidad correctos:** badges de 5 niveles con color **y texto** (contraste AA), dashboard con Cfinal + las 5 categorías + los 10 dominios, filtro por área, y resultado individual del RD con puntaje y nivel por categoría y dominio. Cumple lo que la norma pide reportar.
- **[Medio] El informe está referido al numeral equivocado y le faltan dos incisos.** El contenido del informe lo exige el **numeral 7.7** (incisos a–h); el **7.9 es la periodicidad bienal**. La app llama "informe 7.9" a lo que la norma llama informe del 7.7 (`informe-79-pdf.tsx:199`). Faltan: **b) Objetivo** y **c) Principales actividades del centro**; la sección de método es incompleta (no describe la forma de aplicación conforme 7.4 b–d). → Renombrar y completar.
- **[Medio] La supresión n<3 puede vaciar el propio informe normativo.** La misma supresión del dashboard se aplica al PDF: en un centro de 20 personas con distribución dispersa, la tabla puede quedar mayormente suprimida — y **ningún artefacto de la plataforma contiene los resultados completos**, aunque el 5.8 a) obliga a llevar registro de ellos. → Distinguir audiencias: registro completo para la autoridad laboral (que no es "el patrón" y cuyo registro es obligación legal), generado bajo flujo auditado, frente a las vistas internas suprimidas. Documentar la decisión.
- **[Bajo] El expediente exporta acuses, capacitación y auditoría a nivel empresa, no de ciclo:** en una empresa multi-centro, el expediente de un centro arrastra evidencia de los otros.
- **[OK] Exportación de evidencia:** el ZIP con manifiesto SHA-256 por archivo, hash del ZIP en `compliance_reports`, política real (o marca explícita "ausente", nunca inventada), inmutabilidad por triggers y acceso auditado es, como cadena de evidencia, **mejor que lo que la mayoría de las empresas presenta en papel**.

## 9. Cumplimiento NOM-035

Además de C-01 (textos) y C-02 (cálculo GR-II):

- **[Alto] No existe difusión de resultados a los trabajadores.** El numeral **5.7 e)** obliga a difundir los resultados de la identificación y análisis, y el **7.8** a que estén disponibles para su consulta. El trabajador solo ve _su_ resultado; el dashboard agregado es exclusivo del lado patronal. Sin evidencia de difusión, el inspector levanta incumplimiento aunque la evaluación exista. → Vista/documento agregado (ya con supresión) consultable por los empleados, con acuse, anexado al expediente.
- **[Alto] No hay mecanismo de quejas por violencia laboral (8.1 b).** Obligatorio para **todos** los tamaños de centro. No existe ni captura, ni registro, ni evidencia. Única mención: un texto sugerido en un seed.
- **[Alto] Las "acciones" no son el Programa de intervención que exigen 8.3/8.4.** `action_items` cubre tipo, fecha, responsable y estatus; faltan **a) áreas y trabajadores sujetos** y **e) evaluación posterior**, y no se genera ningún documento "Programa". Una lista suelta de acciones no acredita el Programa ante inspección.
- **[Medio] Registro de trabajadores examinados (5.8 c) sin soporte exportable:** el seguimiento pendiente/canalizado/atendido existe, pero el expediente excluye deliberadamente todo lo ligado a `gr1_results`. El registro es exhibible por norma: contrólese por acceso (generado por el RD, auditado), no por inexistencia.
- **[Medio] Acontecimientos traumáticos severos solo dentro de ciclos:** los numerales 5.5 y 6.5 operan de forma continua (el trabajador informa el ATS por escrito), pero la GR-I solo se distribuye al crear un ciclo. No hay forma de registrar el escrito ni de disparar una GR-I ad hoc.
- **[Medio] Sin integración al diagnóstico de seguridad y salud (7.6 / NOM-030).**
- **[Bajo] Difusión de la política solo por el flujo del cuestionario:** quien no tenga asignación vigente (altas nuevas entre ciclos) nunca la acusa. La app tampoco verifica que la política cubra los tres contenidos del 5.1 ni ofrece la plantilla de la Guía IV.
- **[Bajo] Las "sugerencias Tabla 7" no son la Tabla 7:** el contenido sembrado es de cosecha propia (razonable, cercano al Cap. 8) pero **mal atribuido**: la Tabla 7 del DOF define _criterios por nivel de riesgo_ (Programa de intervención, evaluaciones específicas), no recomendaciones por categoría. → Renombrar y añadir los criterios reales.
- **[Bajo] Guía V (ficha sociodemográfica) no se captura** (solo "área"), aunque las guías la piden tras el cuestionario. Precisión: el "entorno organizacional" **sí** se evalúa (está dentro de la GR-III), y el censo total en lugar de muestreo (7.1 b) **cumple de sobra**.

**Lo que el motor sí transcribe correctamente del DOF** (verificado ítem por ítem): puntajes Likert A directo / B inverso (Tablas 2 y 5); grupos GR-II (A = 18–33) y GR-III (los 35 ítems del grupo A, incluidos los traicioneros 29 y 54); los 8 dominios GR-II y los 10 GR-III con sus rangos; las 5 categorías GR-III; los cortes de Cfinal de ambas guías; los condicionales (65–68/69–72 y 41–43/44–46) registrados como "Nunca" cuando no aplican; y la GR-I completa (secciones 6/2/7/5 — el `PENDIENTE_CONFIRMAR` del seed puede cerrarse: coincide con el DOF; umbrales ≥1/≥3/≥2). La única discrepancia detectada es C-02.

## 10. Código y deuda técnica

Además de C-04 (errores descartados):

- **[Alto] Cliente Supabase sin el generic `Database`:** los 3 clientes se crean sin tipos generados, así que todo `.from()` devuelve `any` estructurado y cada join se "tipa" a mano — **24 `as unknown as` en 11 archivos de producción**. Un rename de columna en una migración **compila limpio y revienta en runtime**; en este producto eso puede significar un informe archivado como evidencia legal con campos vacíos. → `supabase gen types typescript` + `createClient<Database>` + paso de CI que falle si tipos y migraciones divergen. Esfuerzo: M. (Positivo: **cero `as any` / `: any` en toda la app**.)
- **[Alto] El panel entero opera con `service_role`, así que RLS no protege ninguna de sus rutas.** La única defensa multi-tenant en las 15 páginas es que cada una recuerde llamar `autorizarEmpresa()` (hoy todas lo hacen — verificado). Una página futura que lo olvide es fuga cross-tenant **que la suite RLS —el gate de CI— no detectaría**, porque prueba la base de datos, no estas rutas. → Helper que combine autorización + consulta ya filtrada, y una regla de lint que prohíba `clienteAdmin()` en `app/panel/**`; a medio plazo, lecturas del panel con RLS.
- **[Alto] Doble fuente de verdad normativa sin verificación cruzada:** las matrices viven en TypeScript (`motor/datos/`) **y** en SQL (`seeds_normativos.sql`). El motor califica con TS; la UI decide condicionales leyendo la BD. `datos.test.ts` verifica la copia TS con transcripción independiente (excelente), pero **nada compara TS ↔ SQL**: un typo en el seed haría que la UI muestre ítems distintos a los que el motor descarta, sin que falle ningún gate. → Test de integración que compare ambas fuentes 1:1 (la suite RLS ya se conecta a Postgres).
- **[Alto] 14 `event_type` de auditoría como literales sueltos** sin constante ni tipo: `registrarAuditoria(..., eventType: string)` acepta cualquier string. Un typo **no falla en compilación ni en tests** y fragmenta la bitácora — el resumen del expediente cuenta por `event_type` textual. → `as const` + union type.
- **[Alto] Las server actions no tienen ni un test unitario** (`panel.ts` 571 líneas, `informes.ts` 403, `responder.ts` 156). Los E2E cubren caminos felices; **ninguna prueba ejercita las rutas de error** que fallan en silencio (C-04).
- **[Medio] N+1 y bucles secuenciales:** `accionDistribuir` hace 1 INSERT + 1 correo **`await`eados en serie por asignación**. Con el segmento objetivo (101–500 empleados × 2 guías) son hasta 1,000 inserts + 1,000 correos secuenciales en una server action: **timeout casi seguro en Vercel**. Mismo patrón en la importación CSV.
- **[Medio] El expediente trae todo el `audit_log` de la empresa a memoria para contar** (`informes.ts:349-356`), sin filtro de fecha ni ciclo. Es append-only y solo crece.
- **[Medio] Duplicación normativa:** `GUIAS_POR_CATEGORIA` existe dos veces (una sin tipar, con fallback silencioso a "solo GR-I"), y los mapas de etiquetas de nivel están por triplicado (UI, informe, PDF) — el PDF de evidencia y la UI pueden divergir en terminología.
- **[Medio] E2E en un solo navegador y un solo viewport (390 px):** todo el layout desktop del panel (sidebar, tablas anchas) **no tiene ninguna cobertura**.
- **[Medio] CI sin auditoría de dependencias, sin análisis estático de seguridad y sin gate de cobertura** — en un producto que maneja datos de salud. Tampoco hay verificación automatizada de accesibilidad (axe), pese a que las convenciones la exigen.
- **[Bajo] `autorizarEmpresa` se ejecuta 2 veces por request** (layout + página), sin `cache()`: ~5-6 llamadas de red repetidas por navegación.
- **[Bajo] `apps/web/tsconfig.json` no extiende `tsconfig.base.json`** (sin `noUncheckedIndexedAccess`), pese a que las convenciones dicen que todos los paquetes son estrictos.
- **[Bajo] CLAUDE.md desalineado:** §2 dice "Auth con magic links" pero el login real es por contraseña.

### Métricas

| Métrica                                            | Valor                                                      |
| -------------------------------------------------- | ---------------------------------------------------------- |
| Archivos fuente (web + motor + RLS)                | 90 (~10,000 líneas con tests) + seed (799) + 9 migraciones |
| Archivo más grande (producción)                    | `acciones/panel.ts`, 571 líneas                            |
| Tests                                              | ~146 unitarios + 10 E2E (1 navegador, 1 viewport)          |
| `as unknown as` en producción                      | 24 (11 archivos)                                           |
| `as any` / `: any`                                 | **0**                                                      |
| Consultas sin revisar `{ error }`                  | ~63 de ~92                                                 |
| Boundaries de Next (`loading`/`error`/`not-found`) | **0**                                                      |

---

## Lo que está bien hecho

No es un producto mediocre con parches: es un producto con **cimientos de calidad alta** y bordes sin terminar. Merece decirse con evidencia:

1. **El motor GR-III y GR-I son una transcripción exacta del DOF**, verificada ítem por ítem, con tests que **re-transcriben los valores de forma independiente** (`datos.test.ts`) y property-based tests que **reimplementan el oráculo sin reutilizar el código del motor** (`propiedades.test.ts`). Nada normativo hardcodeado fuera de tablas de datos.
2. **La inmutabilidad es real y está en la base de datos**, no en la disciplina del código: triggers que rechazan UPDATE/DELETE en `responses`, `risk_results`, `consents` y `audit_log`; recálculo por `supersedes_id` con un criterio de vigencia **único y compartido** por dashboard, informe y acciones.
3. **El acceso individual del RD es fail-closed**: si el evento `individual_result_access` no puede escribirse, **el dato sensible no se renderiza** ("sin evento no hay consulta"). Es la implementación correcta, y es poco común verla.
4. **Tenancy con defensa estructural**: FKs compuestas `(company_id, id)` en toda la cadena, membresía derivada de la BD y nunca del claim ni de la URL, doble filtro en el 100% de los accesos por id. **No se encontró ningún IDOR.**
5. **`responses` sin GRANT de SELECT ni política de SELECT**: la prohibición de leer respuestas crudas vive en dos capas independientes (privilegios + RLS), no solo en el código. **No se encontró ninguna fuga de respuestas crudas.**
6. **La suite RLS es un gate de CI real** (585 líneas simulando claims JWT por rol contra Postgres), y el E2E cubre el ciclo completo del admin y el aislamiento del consultor.
7. **Trazabilidad de evidencia**: manifiesto SHA-256 por archivo, hash del ZIP, historial auditado, consentimiento con versión/fecha/IP, CSVs con neutralización de inyección de fórmulas, y el manejo honesto del caso "la política existe pero no se pudo descargar → abortar, jamás marcar ausente".
8. **El flujo del empleado es el mejor tramo del producto**: targets de 44 px, `<fieldset>/<legend>` por pregunta, guardado incremental que sobrevive reconexiones, progreso con `aria-live`, y copy empático ("Esto no es un diagnóstico").
9. **Accesibilidad trabajada de forma deliberada**: anillo de foco global citando WCAG 2.4.7, color nunca como única señal en los badges (los 5 pasan AA), `role="alert"` en 14 de 16 errores, drawer con Escape y `aria-expanded`, `lang="es-MX"`, landmarks correctos.
10. **Higiene**: cero secretos hardcodeados, `no-console` como error de lint, correos sin datos sensibles, seed de demo con riel anti-producción, y comentarios que citan la regla inviolable que cada bloque protege.

---

## Top 15 quick wins (alto impacto / bajo esfuerzo)

Ordenados por impacto. "Esfuerzo" en horas de ingeniería.

| #   | Quick win                                                                                              | Dimensión        | Impacto                                                                         | Esfuerzo  |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------- | --------- |
| 1   | **Foco visible en las opciones del cuestionario** — una clase `has-focus-visible:` por label           | A11y (C-06)      | Desbloquea el cuestionario para trabajadores que navegan por teclado            | **0.5 h** |
| 2   | **Suprimir la fila completa** cuando alguna celda se suprime (incluidos los ceros y el total)          | Seguridad (C-03) | Cierra la fuga del nivel de riesgo individual al patrón y a la STPS             | **3 h**   |
| 3   | **Invertir el orden de las guardas** `expirado` antes que `completado` en `responder/[token]/page.tsx` | Seguridad        | El resultado de salud deja de ser visible para siempre desde el correo          | **0.5 h** |
| 4   | **Revisar `{ error }`** en las 9 escrituras que lo descartan (empezando por `accionAcusarPolitica`)    | Código (C-04)    | Deja de perderse evidencia en silencio                                          | **3 h**   |
| 5   | **Gate de CI**: fallar si existe `questions.text LIKE 'ITEM_TEXT_PENDIENTE%'`                          | NOM-035 (C-01)   | Hace imposible desplegar sin las preguntas reales                               | **1 h**   |
| 6   | **`enable_confirmations = true`** + política de contraseñas (12 + composición) + captcha               | Seguridad        | Cierra el _email squatting_ y la fuerza bruta                                   | **1 h**   |
| 7   | **Cabeceras de seguridad** en `next.config.ts` (CSP, HSTS, frame-ancestors, nosniff)                   | Seguridad        | Cierra clickjacking y limita el daño de cualquier XSS                           | **2 h**   |
| 8   | **`error.tsx`, `not-found.tsx`, `loading.tsx`** con marca y en es-MX                                   | UX (C-05)        | Elimina las pantallas de error de Next en inglés y el silencio en la navegación | **3 h**   |
| 9   | **Leer `?error=` en las 6 páginas** con un `<ErrorFormulario>` compartido                              | UX (C-05)        | El admin deja de creer que publicó la política cuando falló                     | **3 h**   |
| 10  | **Validación de subidas**: extensión + MIME + magic bytes + tamaño + nombre generado                   | Seguridad        | Cierra el XSS almacenado dirigido a los trabajadores                            | **3 h**   |
| 11  | **Confirmación previa** en "Distribuir" y "Recordatorios" (+ avisar que rota los enlaces)              | Feedback         | Evita campañas de correo accidentales e irreversibles                           | **2 h**   |
| 12  | **Contrastes**: `slate-400 → slate-600` (porcentajes, tiles) y bordes `slate-200 → slate-400`          | A11y             | Hace legible el dato principal del dashboard                                    | **1 h**   |
| 13  | **`autocomplete`** en el login + `role="alert"` en los 2 errores que faltan                            | A11y             | Gestores de contraseñas y anuncio de errores a lectores de pantalla             | **0.5 h** |
| 14  | **Constantes tipadas** de `event_type`, buckets y `report_type` (`as const` + union)                   | Código           | Un typo deja de poder fragmentar la bitácora de evidencia                       | **2 h**   |
| 15  | **Favicon + borrar los SVG de `create-next-app` + `title.template` por página**                        | Marca            | Deja de verse como un scaffold; títulos de pestaña distinguibles                | **2 h**   |

**Total: ~27 horas** (≈ 4 días de una persona) para cerrar 3 de los 9 críticos por completo y mitigar otros 3.

---

## Plan de ejecución propuesto

Cinco fases. Las dos primeras son **no negociables antes de cualquier piloto con datos reales**; la fase 0 lo es antes de cualquier demo comercial.

### Fase 0 — Validez normativa (bloqueante absoluto) · 2–3 semanas

Sin esto, el producto no puede aplicarse a ningún trabajador real.

| Entregable                                  | Detalle                                                                                                                                                                                                                       | Esfuerzo                       |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Textos oficiales de los 138 ítems           | Transcripción del DOF (GR-I 20, GR-II 46, GR-III 72) + encabezados condicionales + instrucciones · migración + gate de CI                                                                                                     | 1 sem + revisión del consultor |
| **Resolver C-02 (ítems 18–19 de la GR-II)** | Ejecutar la validación cruzada pendiente desde M1: casos del consultor certificado + verificación contra Evalúa035. Si se confirma el error: corregir motor + seed + test, subir versión y **recalcular con `supersedes_id`** | 1 sem (depende del consultor)  |
| Cerrar `PENDIENTE_CONFIRMAR` del seed GR-I  | Ya verificado por esta auditoría (6/2/7/5 coincide con el DOF)                                                                                                                                                                | 1 h                            |

> **Dependencia externa crítica:** la validación con el consultor certificado lleva pendiente desde M1 y es ahora el camino crítico del proyecto. Es lo único que resuelve C-02.

### Fase 1 — Privacidad, evidencia y seguridad (antes de cualquier piloto) · 3–4 semanas

| Entregable                                                                                                                                                    | Cubre                  | Esfuerzo                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------ |
| Supresión por fila + umbral mínimo por vista + **instantáneas** en lugar de agregados en vivo                                                                 | C-03 + ataque temporal | 1 sem                    |
| Caducidad del resultado del empleado + `contextoActivo` en el acuse                                                                                           | Token perpetuo         | 2 d                      |
| Revisión de `{ error }` en las 9 escrituras + helper `datosObligatorios()` en páginas                                                                         | C-04                   | 3 d                      |
| Aviso de privacidad legal, **cargable y versionado por empresa**, archivado en BD con hash                                                                    | C-07                   | 1 sem (+ asesoría legal) |
| Canal de derechos ARCO + política de retención + diseño de **bloqueo y disociación**                                                                          | C-08                   | 1 sem (+ asesoría legal) |
| Endurecimiento de auth (confirmación de correo, contraseñas, MFA para admin/RD, captcha) + cabeceras + validación de subidas + rate limiting de recordatorios | Seguridad              | 3 d                      |
| Prohibir la auto-designación de RD; `puedeGestionar` en las 9 páginas                                                                                         | Autorización           | 2 d                      |

### Fase 2 — Confianza y accesibilidad (antes del primer cliente) · 2–3 semanas

| Entregable                                                                                                         | Cubre            | Esfuerzo |
| ------------------------------------------------------------------------------------------------------------------ | ---------------- | -------- |
| Quick wins 1, 8, 9, 11, 12, 13 (foco, boundaries, errores de formulario, confirmaciones, contrastes, autocomplete) | C-05, C-06, A11y | 1 sem    |
| Drawer con gestión de foco, skip link, anuncio del guardado, `scroll-padding-top`                                  | WCAG 2.2 AA      | 3 d      |
| Reescritura del copy (las 25 filas de la tabla §2) + plantilla descargable del CSV                                 | Copy             | 3 d      |
| Layout de pestañas del ciclo + breadcrumbs + empresa activa/selector en el sidebar                                 | Navegación       | 3 d      |
| **Checklist de primer uso** en `/panel/[empresa]`                                                                  | Onboarding       | 2 d      |
| Identidad: logo, favicon, tokens de color, `title.template`, plantilla de correo con marca                         | Marca (C-09)     | 3 d      |

### Fase 3 — Completar el ciclo normativo · 4–6 semanas

| Entregable                                                                                | Numeral     | Esfuerzo |
| ----------------------------------------------------------------------------------------- | ----------- | -------- |
| Difusión de resultados a los trabajadores, con acuse y anexo al expediente                | 5.7 e), 7.8 | 1 sem    |
| Buzón confidencial de quejas por violencia laboral                                        | 8.1 b)      | 1 sem    |
| **Programa de intervención** con los 6 incisos + exportación                              | 8.3, 8.4    | 1.5 sem  |
| Registro exportable de trabajadores canalizados/examinados (generado por el RD, auditado) | 5.8 c)      | 3 d      |
| Informe: renombrar a **7.7**, añadir Objetivo y Actividades, completar el método          | 7.7 a–h     | 3 d      |
| Registro completo de resultados para la autoridad (sin supresión, flujo auditado)         | 5.8 a)      | 3 d      |
| Registro de acontecimientos traumáticos severos fuera de ciclo                            | 5.5, 6.5    | 3 d      |

### Fase 4 — Escala y deuda técnica · 4–6 semanas

| Entregable                                                                        | Cubre                                  | Esfuerzo |
| --------------------------------------------------------------------------------- | -------------------------------------- | -------- |
| Tipos generados de Supabase + `createClient<Database>` + gate de CI               | 24 `as unknown as`, contrato con la BD | 1 sem    |
| Test de coincidencia normativa **TS ↔ SQL**                                       | Doble fuente de verdad                 | 3 d      |
| Inserciones en lote y correos encolados (distribución, CSV)                       | Timeout con 101–500 empleados          | 1 sem    |
| Tests unitarios de las server actions (rutas de error)                            | Cobertura del hueco real               | 1 sem    |
| Lecturas del panel con RLS (o helper de consulta autorizada + lint)               | RLS que hoy no protege el panel        | 1.5 sem  |
| CI: `pnpm audit`, CodeQL/semgrep, axe en E2E, viewport desktop, gate de cobertura | Seguridad y a11y automatizadas         | 3 d      |
| Constantes tipadas, deduplicación de etiquetas, `cache()` en `autorizarEmpresa`   | Deuda menor                            | 3 d      |

### Resumen del plan

| Fase                                  | Duración | Bloquea                               |
| ------------------------------------- | -------- | ------------------------------------- |
| 0 · Validez normativa                 | 2–3 sem  | **Cualquier demo o uso real**         |
| 1 · Privacidad, evidencia y seguridad | 3–4 sem  | **Cualquier piloto con datos reales** |
| 2 · Confianza y accesibilidad         | 2–3 sem  | Primer cliente de pago                |
| 3 · Ciclo normativo completo          | 4–6 sem  | Aprobar una inspección de la STPS     |
| 4 · Escala y deuda técnica            | 4–6 sem  | Operar 200 organizaciones             |

**Camino crítico:** la validación del motor con el consultor certificado (fase 0) es la única tarea con dependencia externa y sin ella no se puede cerrar C-02. **Debe arrancarse hoy, en paralelo con todo lo demás.**

---

## Deuda abierta reconocida (actualizado al cierre de la Fase 4.5, 2026-07-14)

Lo que se deja abierto **a propósito**, con su porqué y su plan.

> **Deuda normativa (dimensión 9): VACÍA.** Con la Fase 4.5 no queda ningún incumplimiento
> de la NOM-035 identificado por esta auditoría. Lo que sigue abierto abajo es de
> **dependencia externa** (validación del motor por consultor, texto legal del aviso y DPA,
> criterio legal de retención) o de deuda técnica/producto (dimensión 10 y el ataque de
> inferencia temporal), no de cumplimiento normativo.

| Deuda                                                                                                                                                                                                                                                                                                                                | Por qué queda abierta                                                                                                                         | Plan                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Validación del motor por consultor certificado** (cierra C-02 de forma definitiva y la validación de lanzamiento de M1)                                                                                                                                                                                                            | Dependencia externa: los 3–5 casos resueltos siguen en gestión                                                                                | Camino crítico del proyecto. Al recibirlos: cargarlos en `reference-cases/` (el test `todo` ya falla en modo release si está vacío); criterio 100%          |
| **Texto del aviso de privacidad** (C-07) — hoy es plantilla base con campos `{{...}}`                                                                                                                                                                                                                                                | Redactarlo es trabajo de abogado, no de ingeniería; cada empresa cliente es la responsable                                                    | Revisión legal + contrato de encargo (DPA) por cliente **antes de cualquier piloto con datos reales**                                                       |
| **Retención, bloqueo y disociación** (C-08) — el canal ARCO existe; la salida del dato, no                                                                                                                                                                                                                                           | El periodo de retención requiere criterio legal (art. 11 vs. obligación NOM-035); el diseño bloqueo+disociación es compatible con append-only | Fase 1 restante: definir retención con asesoría legal; implementar bloqueo (negar lectura) y disociación (romper `employee_id` conservando agregado y hash) |
| ~~Panel con `service_role`~~ (✅ cerrado en Fase 2.5: `c3eef6d` — cliente de sesión + RLS real + guardia de lint; `service_role` solo en usos justificados y comentados)                                                                                                                                                             | —                                                                                                                                             | Hecho antes de lo planeado (era Fase 4)                                                                                                                     |
| **Inferencia temporal sobre agregados en vivo** (relacionado con C-03) — consultar el dashboard antes/después de cada respuesta revela el nivel de quien respondió                                                                                                                                                                   | Cerrarla exige instantáneas (snapshot) en lugar de agregados en vivo: cambio de producto, no un parche                                        | Fase 1 restante; mientras tanto está documentado en `agregados.ts` y CLAUDE.md                                                                              |
| **Recálculo GR-II 0.1.0: verificado que no aplica** (`37fc798`)                                                                                                                                                                                                                                                                      | No es deuda: se documenta para cerrar el ciclo. No existe ningún resultado real calculado con 0.1.0                                           | Si apareciera una BD antigua: filas nuevas con `supersedes_id` y motor ≥0.2.0 (mecanismo ya existente)                                                      |
| ~~C-09 · Marca~~ (Fase 2) · ~~captcha/MFA/rate limiting/plantilla CSV~~ (Fase 2.5) · quedan: `loading.tsx` (revertido en `d7fd567` — el Router Cache servía contenido viejo tras mutaciones; ver Remediación 2.5), recordatorios/informes sin límite propio ni idempotencia, auto-designación de RD sin control, caducidad de sesión | El `loading.tsx` depende del comportamiento del router de Next; el resto es endurecimiento incremental que no bloquea normativa ni privacidad | Remates en fases 3–4: ver plan de fases                                                                                                                     |

---

## Anexo · Límites de esta auditoría

Fue estática (lectura de código); **no se realizó pentest dinámico**. Quedan sin verificar contra un entorno real:

- Efectividad de RLS ante un JWT manipulado (la suite existe y es gate de CI, pero no se ejecutó aquí). **Nota relevante:** el flujo del empleado corre íntegramente con `service_role` y `employees.auth_user_id` nunca se escribe, así que las políticas RLS que dependen de `app.es_empleado()` son **inalcanzables en la práctica**: no protegen nada hoy. No es una vulnerabilidad, pero sí un falso sentido de cobertura.
- Si una URL firmada de Supabase sirve `text/html` _inline_ (determina si el hallazgo de subidas es XSS ejecutable o solo descarga).
- Flags reales de las cookies de sesión (`httpOnly`/`Secure`/`SameSite`) y cabeceras que Vercel añada por defecto.
- Límites de tasa del proyecto Supabase **en la nube** (`config.toml` gobierna solo el entorno local).
- Explotación práctica del _email squatting_.
- **C-02 no puede resolverse desde el código:** requiere el texto oficial del DOF contrastado por el consultor certificado.
