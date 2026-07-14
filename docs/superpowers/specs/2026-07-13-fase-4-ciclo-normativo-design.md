# Fase 4 — Ciclo normativo completo (diseño)

**Fecha:** 2026-07-13 · **Rama:** `fase-4-ciclo-normativo` · **Cierra:** los hallazgos [Alto] de la
dimensión 9 de `docs/AUDITORIA.md` (difusión de resultados 5.7 e)/7.8, buzón de quejas 8.1 b),
Programa de intervención 8.3/8.4) y amplía el expediente de inspección.

**Base normativa verificada contra el DOF (23-oct-2018, nota 5541828):**

- **5.7 e)** — el patrón debe _difundir_ a los trabajadores los resultados de la identificación y
  análisis de FRP (16–50) y de la evaluación del entorno organizacional (>50). **7.8** — los
  resultados deben _estar disponibles para consulta_ de los trabajadores. El PEC (tabla del 10.2,
  fila 5.7) acepta comprobación **documental**; las observaciones admiten folletos/boletines/carteles.
  **10.4** admite evidencia en medios electrónicos.
- **8.1 b)** — "mecanismos seguros y confidenciales para la recepción de quejas por prácticas
  opuestas al entorno organizacional favorable y para denunciar actos de violencia laboral".
  **5.7 d)** obliga a difundir esos mecanismos. **8.2 g)** exige procedimientos de actuación y
  seguimiento.
- **8.3** — cuando el resultado de las evaluaciones 7.1–7.4 lo determine "conforme a los criterios
  establecidos en el método aplicado", las acciones de control se implementan **a través de un
  Programa** que cumpla el **8.4**: a) áreas/trabajadores sujetos; b) tipo de acciones y medidas de
  control; c) fechas programadas; d) control de avances; e) evaluación posterior, en su caso;
  f) responsable de su ejecución. **8.5** define los tres niveles de acción (organizacional,
  grupal, individual; el tercero solo por médico/psicólogo/psiquiatra).
- La tabla de criterios es la **Tabla 4 (Guía II)** y su gemela **Tabla 7 (Guía III)**, ambas
  "Criterios para la toma de acciones": Programa de intervención **obligatorio para medio, alto y
  muy alto** (II.4/III.4 literal); muy alto _deberá_ incluir evaluaciones específicas, alto _podrá_;
  bajo = mayor difusión; nulo = nada. El PEC acota el Programa a centros **>15 trabajadores**.
- Deuda de numeración reconocida (fuera de alcance de esta fase): el "informe 7.9" del producto es
  el informe del **7.7** (7.9 es la periodicidad bienal). Se corrige en una fase posterior junto con
  los incisos b) y c) que le faltan.

---

## 1. Difusión de resultados a los trabajadores

**Concepto:** una **constancia de difusión** por ciclo: instantánea agregada (jamás promedios,
supresión n<3 con enmascarado de fila completa) redactada en lenguaje llano, **sellada con sha256**
y versionada append-only. El trabajador la consulta desde su mismo enlace tokenizado y puede
acusar "Enterado". Al ser instantánea (no agregado en vivo), de paso NO amplía la superficie de
inferencia temporal documentada en `agregados.ts`.

**Datos (migración nueva):**

- `dissemination_records` — `id`, `company_id`, `cycle_id`, `version int` (consecutivo por ciclo),
  `summary jsonb` (la instantánea: distribución global + por categoría + resumen GR-I + texto
  llano + conteo de acciones comprometidas + referencia al buzón), `sha256`, `published_by uuid`,
  `published_at`. **Append-only** (trigger `app.rechazar_modificacion`); nueva versión = fila
  nueva. FK compuesta `(company_id, cycle_id)`. GRANT: select a `authenticated` (contenido ya
  suprimido, es lo que se publica), insert vía política de gestión; `service_role` all.
- `dissemination_receipts` — `id`, `company_id`, `dissemination_id`, `employee_id`,
  `acknowledged_at`. `unique (dissemination_id, employee_id)`. FKs compuestas. Patrón
  `policy_acknowledgments`. Insert solo `service_role` (flujo del empleado); select gestión.

**Flujo del panel:** pestaña nueva **"Difusión"** en `ciclos/[ciclo]/layout.tsx`. El admin ve la
vista previa (mismos agregados del dashboard, congelados), publica con confirmación → se calcula la
instantánea del lado servidor (mismo criterio `resultadosVigentesPorAsignacion` + supresión),
sha256 del JSON canónico, fila nueva. Auditoría `difusion_publicada`. Muestra versiones publicadas,
fecha, hash y conteo de acuses.

**Flujo del empleado:** en `/responder/[token]` (cualquier estado no-expirado, incluido
completado), si existe difusión publicada del ciclo se muestra "Resultados generales de tu centro
de trabajo" (render del `summary`, lenguaje llano) con botón de acuse → `dissemination_receipts`
(vía acción de servidor con las mismas guardas de token + limitador). El resultado propio del
trabajador NO cambia.

**Reglas inviolables:** el `summary` pasa por `distribucionNiveles`/enmascarado ANTES de sellarse;
la fila es inmutable; nada individual viaja en él.

## 2. Buzón de quejas y denuncias (8.1 b)

**Concepto:** canal **por empresa** (no por ciclo: la obligación es continua), accesible sin sesión
mediante **token propio de larga vida** (`/buzon/[token]`), con anonimato a elección explícita del
trabajador, folio + clave de seguimiento, estados y bitácora. El contenido de una queja recibe el
**mismo estándar de sensibilidad que los resultados individuales**: sin GRANT para `authenticated`,
lectura solo vía la app con auditoría fail-closed.

Un token por empresa (y no por empleado) es lo que hace el anonimato **técnicamente** cierto: con
token personal el servidor sabría quién envía aunque marque "anónimo".

**Datos (migración nueva):**

- `complaint_boxes` — `company_id` (PK, FK a companies), `token_hash text unique`, `rotated_at`.
  Se crea al vuelo la primera vez que el admin abre la sección Buzón; el admin puede rotar el
  enlace (auditado `buzon_enlace_rotado`). GRANT: select gestión; escritura `service_role`.
- `complaints` — `id`, `company_id`, `folio text` (`unique`, formato legible p. ej.
  `QJ-XXXX-XXXX`), `folio_key_hash text` (sha256 de la clave de consulta; solo el hash toca BD),
  `category text check in ('violencia_laboral','practicas_opuestas_eof')`,
  `body text`, `is_identified boolean`, `contact_name text`, `contact_info text`
  (solo si `is_identified`), `status text check in
('recibida','en_revision','atendida','cerrada') default 'recibida'`, `created_at`.
  Trigger especializado `app.queja_solo_estado()` (patrón `gr1_solo_canalizacion`): UPDATE solo
  puede cambiar `status`; DELETE/TRUNCATE prohibidos. **Sin GRANT de SELECT para `authenticated`**
  (patrón `risk_results`): el único camino al contenido es la app auditada.
- `complaint_events` — `id`, `company_id`, `complaint_id`, `from_status`, `to_status`,
  `note text`, `actor_user_id`, `created_at`. Append-only. Es la bitácora de seguimiento (8.2 g).

**Flujo del trabajador (`/buzon/[token]`, ruta `(centrado)`, sin sesión, service_role):**

1. Enviar queja: categoría (dos opciones en lenguaje llano), texto libre, elección EXPLÍCITA
   "¿Quieres identificarte?" (radio anónimo/identificado; identificado habilita nombre y contacto).
   Al enviar se muestran **una sola vez** el folio y la clave de consulta. Limitador
   `buzon:<ip>` (p. ej. 5/hora) + `token-miss:<ip>` reutilizado para tokens inválidos.
2. Consultar folio: folio + clave → estado actual + fechas de transición (solo metadatos, nunca se
   re-muestra el contenido — la clave impresa en un papel no debe exponer el texto). Limitador
   `buzon-folio:<ip>` (p. ej. 30/10 min).
3. Correo genérico a los admins/RD al recibirse ("Nueva queja en el buzón", sin contenido, actor
   sistema), evento `queja_recibida` (sin contenido en `details`).

**Flujo del panel:** sección **"Buzón"** en el sidebar de la empresa. Lista con folio, categoría,
estado, fecha (SIN contenido). Ver detalle = acción auditada **fail-closed**
(`registrarAuditoriaEstricta` con `queja_consultada`, patrón del acceso individual del RD); pueden
verlo `admin_org`, `consultor` y el RD. Cambiar estado exige nota → fila en `complaint_events` +
evento `queja_actualizada`. El texto libre del trabajador se renderiza SIEMPRE como texto (JSX lo
escapa; prohibido `dangerouslySetInnerHTML`), y jamás se incluye en correos.

**Difusión del mecanismo (5.7 d):** el enlace del buzón se muestra en la página del empleado
(`/responder/[token]`, cualquier estado), dentro de la constancia de difusión, y el panel ofrece el
enlace para difundirlo (cartel/correo internos de la empresa).

## 3. Programa de intervención (8.3/8.4/8.5)

**Concepto:** cuando los resultados vigentes del ciclo tengan Cfinal, alguna categoría o algún
dominio en **medio/alto/muy alto**, el ciclo exige un **Programa** (documento con los 6 incisos del
8.4), con acciones pre-pobladas desde los criterios literales de la Tabla 4/7 y evidencia adjunta
por acción. La página de "Acciones correctivas" evoluciona a **"Programa de intervención"**.

**Datos (migración nueva):**

- `intervention_programs` — `id`, `company_id`, `cycle_id` (`unique (company_id, cycle_id)`: un
  programa por ciclo), `scope_areas text` (8.4 a: áreas/trabajadores sujetos), `responsible text`
  (8.4 f), `post_evaluation text` y `post_evaluation_date date` (8.4 e, nullable "en su caso"),
  `created_by`, `created_at`, `updated_at`. Documento de trabajo: editable (no append-only), cambios
  auditados (`programa_creado`/`programa_actualizado`). RLS/GRANT: select miembro, escritura gestión.
- `action_items` (extensión): `program_id uuid` nullable + FK compuesta
  `(company_id, program_id)`, `target_areas text` (8.4 a por acción), `action_level text check in
('primer_nivel','segundo_nivel','tercer_nivel')` nullable (8.5), `evidence_path text`,
  `evidence_sha256 text`, `completed_at timestamptz`. Filas existentes siguen válidas (todo nullable).
- Seed `system_config` key `criterios_toma_acciones`: el texto **literal** de la Tabla 4/7 por
  nivel (regla 7: nada normativo hardcodeado) + las acciones pre-pobladas sugeridas por nivel
  (derivadas del texto: muy alto → evaluación específica obligatoria + campaña de sensibilización +
  revisión de política; alto → campaña + revisión, evaluación específica opcional; medio → revisión
  y refuerzo de política/programas). La clave existente `sugerencias_tabla7` se conserva (contenido
  propio, ya renombrado en UI como sugerencias).
- Bucket privado `evidencias` para la evidencia de avance por acción (PDF/PNG/JPEG validados por
  magic bytes con `validarPdf`/`validarImagen`, nombre de servidor con `rutaDeObjeto`).

**Flujo:** la página del programa muestra el estado normativo del ciclo (niveles vigentes por
Cfinal/categoría/dominio — ya se calculan para el dashboard), y si hay medio+ y no hay programa,
guía su creación: formulario de los campos 8.4 + pre-población de acciones por los niveles
encontrados (editable antes de crear). Cada acción: descripción, nivel de acción 8.5, áreas,
responsable, fecha compromiso, estado, evidencia adjunta y fecha de completado. El avance (d) se
deriva de los estados + `complaint_events`-style trazabilidad vía auditoría existente.

**Exportación:** documento **`programa-intervencion.pdf`** (@react-pdf, mismo pipeline del informe)
estructurado por los 6 incisos del 8.4 — es el "documento Programa" cuya ausencia señaló la
auditoría — y CSV de avance para el expediente.

## 4. Expediente ZIP completo

Ampliación de `informes/expediente.ts` (módulo puro) + `accionGenerarExpediente`:

- **`INDICE.txt`** como PRIMERA entrada del ZIP: índice legible (es-MX) con cada archivo, su
  descripción de una línea y su sha256 (complementa `manifiesto.json`, que se conserva).
- `informe-7-9.pdf` (existente) y `politica-prevencion.*` + `acuses-politica.csv` (existentes).
- **`cuestionarios-aplicados.json`**: versión sellada de los instrumentos aplicados en el ciclo —
  por guía: número de ítem, texto oficial vigente (de `questions`), estructura de secciones, y
  sha256 del documento (evidencia de QUÉ instrumento se aplicó; conecta con el gate
  `verificar:textos`).
- **`constancia-difusion.pdf`** o `.json` de la última `dissemination_record` del ciclo (contenido
  - versión + fecha + sha256) y **`acuses-difusion.csv`** (empleado, versión, fecha).
- **`programa-intervencion.pdf`** + **`programa-avances.csv`** (acción, nivel 8.5, áreas,
  responsable, fecha compromiso, estatus, fecha completado, evidencia sha256 — la evidencia en sí
  no se embebe, se referencia por hash).
- **`buzon-registro.csv`**: SOLO agregado (conteos por categoría × estado × mes) — jamás contenido,
  folios ni datos del denunciante. Evidencia de que el mecanismo existe y opera.
- Todos los CSVs pasan por `construirCsv` (BOM + RFC 4180 + neutralización de fórmulas). Manifiesto
  y sha256 se actualizan solos. Si una pieza no existe (sin difusión, sin programa, sin quejas), el
  índice y el manifiesto la marcan **"ausente"** explícitamente — nunca se inventa ni se omite en
  silencio (patrón de la política).

## Transversales

- **Auditoría** (`EVENTOS_AUDITORIA` + union): `difusion_publicada`, `difusion_acusada`,
  `buzon_enlace_rotado`, `queja_recibida`, `queja_consultada` (estricta), `queja_actualizada`,
  `programa_creado`, `programa_actualizado`, `evidencia_accion_subida`.
- **RLS**: toda tabla nueva con RLS + GRANT explícito mínimo + tests nuevos en
  `packages/pruebas-rls` (aislamiento entre tenants, negación de SELECT de `complaints` a
  `authenticated`, append-only de `dissemination_records`/`complaint_events`).
- **Limitador**: claves nuevas `buzon:<ip>`, `buzon-folio:<ip>`, y las acciones por token del
  empleado reutilizan `token:<hash16>`.
- **ESLint service_role allowlist**: se añaden solo las páginas nuevas que lo justifiquen
  (detalle de queja — lectura auditada; difusión usa agregación como el dashboard).
- **E2E** (`ciclo-normativo.spec.ts`): publicar difusión → verla y acusarla con el token del
  empleado; enviar queja anónima → folio → consultarla en el panel (auditada) → cambiar estado →
  consultar folio como trabajador; crear programa pre-poblado y completar una acción. El expediente
  ampliado se cubre con unit tests de `expediente.ts` (el E2E de informes existente sigue).
- **Unit tests** (TDD en lo puro): generación/verificación de folio y clave, instantánea de
  difusión (supresión aplicada, sha256 estable con JSON canónico), pre-población por niveles,
  `INDICE.txt` y nuevas entradas del expediente.
- **Correos**: siempre `plantillaCorreo` (escape), jamás contenido de quejas ni resultados.
- **Versión**: `apps/web/package.json` → 0.5.0; tag al cierre `v0.5-ciclo-completo`.

## Alternativas consideradas

- _Difusión como página pública por empresa_: descartada — el enlace tokenizado existente ya
  autentica "es trabajador del centro" sin crear una superficie pública nueva.
- _Buzón con token por empleado_: descartado — rompe el anonimato técnico (el servidor sabría
  quién envía); el token por empresa + folio con clave da seguimiento sin identidad.
- _Programa como tabla append-only_: descartado — es un documento de trabajo vivo (8.4 d exige
  control de avances); la evidencia de cambios queda en `audit_log`, y lo que sí es evidencia
  congelada (el PDF exportado) se sella con sha256 en el expediente.
- _Extender `action_items` sin tabla de programa_: descartado — el 8.4 tiene campos de nivel
  programa (áreas sujetas, responsable de ejecución, evaluación posterior) que no viven bien
  repetidos por acción, y el inspector pide "un Programa", no una lista.
