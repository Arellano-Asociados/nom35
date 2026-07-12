# Milestone 5 — Informe 7.9 y expediente de inspección: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generar el informe normativo del numeral 7.9 (PDF descargable) y el expediente de inspección (ZIP con evidencia documental) por ciclo de cumplimiento, con integridad sha256, registro en `compliance_reports` y auditoría completa.

**Architecture:** Módulo puro de armado de datos (`lib/informe.ts`, testeable sin I/O, reutiliza la supresión n<3 de `lib/agregados.ts`) → plantilla PDF con `@react-pdf/renderer` (sin headless browser, apto Vercel) → acciones de servidor que autorizan, generan, suben al bucket privado `informes`, insertan en `compliance_reports` (append) y auditan. El expediente ZIP (jszip) empaqueta el informe + evidencias existentes + manifiesto con sha256 por archivo.

**Tech Stack:** Next.js 15 (App Router, acciones de servidor), Supabase (storage + service_role), `@react-pdf/renderer` v4, `jszip`, Vitest, Playwright.

## Global Constraints

- Reglas inviolables de CLAUDE.md: sin promedios (solo distribuciones/conteos); supresión n<3 en TODA celda agregada del PDF y del ZIP; jamás respuestas crudas ni resultados individuales en informe/expediente (son patronales); `company_id` derivado de membresía verificada, nunca del request; nada normativo hardcodeado en el motor.
- `compliance_reports` es append-only por convención (INSERT solamente; nunca UPDATE/DELETE).
- Toda tabla/bucket nuevo necesita GRANT explícito + política RLS (no hay default privileges). Bucket `informes` privado: solo service_role.
- Acciones de servidor en `apps/web/src/acciones/`, componentes cliente en `src/components/` (NUNCA bajo carpetas con corchetes).
- UI íntegramente es-MX, accesible. Commits atómicos en español. TDD: test primero.
- Windows: no reescribir fuentes con Get-Content/Set-Content de PowerShell 5.1 (corrompe acentos). Usar herramientas Write/Edit.
- Prohibido loggear respuestas/resultados; correos sin datos sensibles.
- Auditoría: usar `registrarAuditoria()` de `apps/web/src/acciones/panel.ts:22` (extraerlo a `src/lib/auditoria.ts` si hay import circular).

## Contenido normativo del informe (numeral 7.9)

El informe debe contener: a) el o los centros de trabajo evaluados; b) el método utilizado (guías aplicadas según categoría del centro); c) los resultados obtenidos (distribuciones por nivel global, por categoría y por dominio, con supresión n<3; resumen GR-I); d) las conclusiones; e) las recomendaciones y acciones de intervención (action_items + sugerencias Tabla 7); f) los datos del evaluador (`compliance_cycles.evaluator_name` / `evaluator_license`); g) la fecha de evaluación (rango del ciclo).

## Contenido del expediente ZIP

`manifiesto.json` (lista de archivos con sha256 + metadatos del ciclo) + `informe-7-9.pdf` + `politica-prevencion.<ext>` (desde bucket `politicas`, si publicada) + `acuses-politica.csv` (empleado, fecha — sin datos de salud) + `participacion.csv` (asignados/completados por centro, sin identificar resultados) + `acciones.csv` (Tabla 7) + `capacitacion.csv` (registros) + `resumen-auditoria.csv` (conteo de eventos por tipo, sin detalles sensibles).

---

### Task 1: Migración — bucket `informes`

**Files:**

- Create: `supabase/migrations/20260712000000_informes.sql`

**Interfaces:**

- Produces: bucket privado `informes` en storage (solo service_role), siguiendo el patrón exacto de `supabase/migrations/20260711220000_panel_admin.sql:5` (buckets `politicas`/`capacitacion`).

- [ ] **Step 1: Escribir la migración** copiando el patrón de creación de bucket de `panel_admin.sql` (insert en `storage.buckets` con `public = false`, idempotente con `on conflict do nothing`). Sin políticas de storage para roles no-service (los archivos solo se sirven vía signed URL creado con service_role tras autorización en acción de servidor).
- [ ] **Step 2: Verificar reproducibilidad**: `pnpm exec supabase db reset` termina sin error y `select id from storage.buckets` incluye `informes`.
- [ ] **Step 3: Correr suite RLS local** (`pnpm --filter @nom35/pruebas-rls test:rls`) para confirmar que nada se rompió.
- [ ] **Step 4: Commit** — `BD: bucket privado de informes para expediente de inspección`.

### Task 2: Módulo puro de armado de datos del informe

**Files:**

- Create: `apps/web/src/lib/informe.ts`
- Test: `apps/web/src/lib/informe.test.ts` (Vitest, junto a `agregados` — seguir patrón de tests existentes en `src/lib/`)

**Interfaces:**

- Consumes: `celda`, `distribucionNiveles`, `distribucionPorNombre` de `src/lib/agregados.ts` (verificar firmas reales antes de usar).
- Produces:

```ts
export interface DatosInforme79 {
  empresa: { razonSocial: string; rfc: string };
  centros: Array<{ nombre: string; domicilio: string; actividad: string;
                   headcount: number; nomCategory: string; guias: string[] }>;
  ciclo: { nombre: string; fechaInicio: string; fechaFin: string | null;
           evaluadorNombre: string; evaluadorCedula: string | null };
  participacion: { asignados: number; completados: number };
  resultados: {
    global: ReturnType<typeof distribucionNiveles>;
    categorias: ReturnType<typeof distribucionPorNombre>;
    dominios: ReturnType<typeof distribucionPorNombre>;
  };
  gr1: { evaluados: number; requierenValoracion: number | null }; // null = suprimido n<3
  conclusiones: string[];
  acciones: Array<{ descripcion: string; nivelOrigen: string; responsable: string;
                    fechaCompromiso: string | null; estatus: string }>;
  motorVersion: string;
  generadoEl: string; // ISO, lo inyecta la acción (no usar Date.now aquí)
}

export function armarDatosInforme79(entrada: {
  empresa: ...; centros: ...; ciclo: ...; asignaciones: ...;
  resultadosVigentes: ...; resultadosGr1: ...; acciones: ...; generadoEl: string;
}): DatosInforme79;
```

Reglas dentro de la función: usar solo el resultado VIGENTE por asignación (fila más reciente sin `supersedes_id` apuntándole — mismo criterio que el dashboard); `gr1.requierenValoracion = null` cuando `0 < n < 3`; `conclusiones` generadas por reglas deterministas (nivel predominante global; si hay medio/alto/muy alto → obligación de acciones per Cap. 8; recordatorio de reevaluación a 2 años).

- [ ] **Step 1: Leer `src/lib/agregados.ts` y el dashboard** (`app/panel/[empresa]/ciclos/[ciclo]/dashboard/page.tsx`) para copiar el criterio exacto de "resultado vigente" y las firmas reales.
- [ ] **Step 2: Escribir tests que fallan** — casos: (a) armado feliz con 5 resultados mezclados y distribución correcta; (b) supresión: 2 empleados que requieren valoración GR-I → `requierenValoracion: null`; (c) resultado superseded excluido; (d) conclusión de acciones presente si hay nivel alto; (e) centros con guias derivadas de `nom_category` (≤15 → GR-I; 16–50 → GR-I+GR-II; >50 → GR-I+GR-III).
- [ ] **Step 3: Correr tests, verificar que fallan** (`pnpm --filter web test -- informe`).
- [ ] **Step 4: Implementar `armarDatosInforme79`** (función pura, sin I/O, sin Date).
- [ ] **Step 5: Tests verdes + `pnpm lint` + `pnpm typecheck`.**
- [ ] **Step 6: Commit** — `Informe 7.9: armado puro de datos con supresión n<3 (TDD)`.

### Task 3: Plantilla PDF del informe

**Files:**

- Create: `apps/web/src/informes/informe-79-pdf.tsx` (componente `@react-pdf/renderer` — NO es componente cliente de Next; vive fuera de `app/`)
- Create: `apps/web/src/informes/generar-pdf.ts` (`renderToBuffer`)
- Test: `apps/web/src/informes/generar-pdf.test.ts`

**Interfaces:**

- Consumes: `DatosInforme79` (Task 2).
- Produces: `generarPdfInforme79(datos: DatosInforme79): Promise<Buffer>`.

- [ ] **Step 1: Instalar dependencia**: `pnpm --filter web add @react-pdf/renderer` (v4, compatible React 19; si el typecheck revela incompatibilidad, evaluar `pdf-lib` como plan B y documentarlo).
- [ ] **Step 2: Test que falla**: `generarPdfInforme79(datosDeEjemplo)` devuelve un Buffer que empieza con `%PDF` y pesa > 1KB. (No se valida layout por test; la validación visual va en el E2E/manual.)
- [ ] **Step 3: Implementar plantilla**: secciones a–g del numeral 7.9 (ver arriba), tablas de distribución con celdas suprimidas mostradas como “—​ (n<3)”, fuente Helvetica (acentos OK), encabezado con razón social/RFC y pie con `motorVersion`, `generadoEl` y leyenda de integridad (el sha256 se registra en BD, no dentro del PDF).
- [ ] **Step 4: Tests verdes + lint + typecheck.**
- [ ] **Step 5: Commit** — `Informe 7.9: plantilla PDF con @react-pdf/renderer`.

### Task 4: Acción de servidor — generar informe 7.9

**Files:**

- Modify: `apps/web/src/acciones/panel.ts` (o crear `src/acciones/informes.ts` si panel.ts ya es muy grande — preferible archivo nuevo)
- Test: cubierto por E2E (Task 7); la lógica pura ya está testeada en Tasks 2–3.

**Interfaces:**

- Consumes: `autorizarEmpresa`, `puedeGestionar` (`src/lib/autorizacion.ts`), `clienteAdmin`, `armarDatosInforme79`, `generarPdfInforme79`, `registrarAuditoria`.
- Produces: `accionGenerarInforme79(companyId: string, cycleId: string): Promise<{ ok: true; reporteId: string } | { ok: false; error: string }>`.

Flujo obligatorio de la acción:

1. `autorizarEmpresa(companyId)` + `puedeGestionar` (admin_org o consultor; el informe solo contiene agregados).
2. Leer con `clienteAdmin()`: empresa, centros, ciclo (validar que pertenece a la empresa vía FK compuesta), asignaciones, `risk_results` vigentes, `gr1_results`, `action_items`.
3. `armarDatosInforme79(...)` con `generadoEl = new Date().toISOString()` (la fecha vive en la acción, no en el módulo puro).
4. `generarPdfInforme79(datos)` → sha256 con `crypto.createHash('sha256')`.
5. Subir a `informes/${companyId}/${cycleId}/informe-79-${Date.now()}.pdf`.
6. INSERT en `compliance_reports` (`report_type: 'informe_79'`, `storage_path`, `sha256`).
7. `registrarAuditoria(companyId, actor, 'informe_generado', 'compliance_reports', id, { cycleId, sha256 })`.
8. `revalidatePath` de la página de informes.

- [ ] **Step 1: Implementar la acción** siguiendo el flujo anterior y las convenciones exactas de las acciones existentes en `panel.ts` (manejo de errores, tipos de retorno).
- [ ] **Step 2: Acción de descarga** `accionUrlDescargaInforme(companyId, reporteId)`: autoriza, busca `storage_path`, crea signed URL (60s) con `clienteAdmin()`, audita `informe_descargado`. Reutilizar el patrón de `createSignedUrl` de `src/lib/flujo.ts:253`.
- [ ] **Step 3: lint + typecheck verdes.**
- [ ] **Step 4: Commit** — `Acciones de servidor: generar y descargar informe 7.9 con auditoría`.

### Task 5: Expediente de inspección (ZIP)

**Files:**

- Create: `apps/web/src/informes/expediente.ts` (armado puro de manifiesto + CSVs a partir de datos ya leídos)
- Modify: `apps/web/src/acciones/informes.ts` (nueva acción)
- Test: `apps/web/src/informes/expediente.test.ts`

**Interfaces:**

- Consumes: `jszip` (`pnpm --filter web add jszip`), `DatosInforme79`, buffer del PDF, archivo de política (bytes) si existe, filas de acuses/capacitación/participación/auditoría.
- Produces:
  - `armarExpediente(entrada): Promise<{ zip: Buffer; manifiesto: ManifiestoExpediente }>` — puro salvo jszip; cada archivo listado en `manifiesto.json` con su sha256.
  - `accionGenerarExpediente(companyId, cycleId)` — mismo flujo que Task 4 con `report_type: 'expediente_zip'` y evento `expediente_generado`.

- [ ] **Step 1: Tests que fallan**: (a) el ZIP contiene `manifiesto.json`, `informe-7-9.pdf` y los CSVs esperados; (b) los sha256 del manifiesto coinciden con los bytes reales; (c) los CSVs de acuses/participación NO contienen niveles de riesgo ni nada de `risk_results` (asegura frontera de datos); (d) sin política publicada → el manifiesto la marca `ausente` y el ZIP no truena.
- [ ] **Step 2: Implementar `armarExpediente` + CSVs** (escapado CSV correcto para comas/comillas/acentos; UTF-8 con BOM para que Excel es-MX los abra bien).
- [ ] **Step 3: Tests verdes.**
- [ ] **Step 4: Implementar `accionGenerarExpediente` + descarga auditada** (reutiliza `accionUrlDescargaInforme`, que sirve cualquier fila de `compliance_reports`).
- [ ] **Step 5: lint + typecheck + commit** — `Expediente de inspección ZIP con manifiesto sha256 (TDD)`.

### Task 6: UI del panel — página de informes del ciclo

**Files:**

- Create: `apps/web/src/app/panel/[empresa]/ciclos/[ciclo]/informes/page.tsx` (server component)
- Create: `apps/web/src/components/panel/generar-informe.tsx` (client component con botones/estado — fuera de carpetas con corchetes)
- Modify: navegación del ciclo (donde estén las pestañas dashboard/acciones/gr1 — replicar patrón existente)

**Interfaces:**

- Consumes: acciones de Tasks 4–5; lista `compliance_reports` del ciclo (SELECT de gestión ya permitido por RLS `rls_tenant.sql:264`).
- Produces: página “Informes y expediente” con: botón “Generar informe 7.9”, botón “Generar expediente de inspección”, tabla histórica (tipo, fecha, sha256 abreviado con title completo, botón Descargar). Estados de carga y error en es-MX; accesible (botones reales, aria-busy).

- [ ] **Step 1: Server component**: autoriza, lista informes del ciclo ordenados por fecha desc.
- [ ] **Step 2: Client component** con `useTransition` para generar/descargar (la descarga abre la signed URL devuelta).
- [ ] **Step 3: Añadir la pestaña** siguiendo el patrón del layout del ciclo.
- [ ] **Step 4: lint + typecheck + commit** — `Panel: página de informes y expediente por ciclo`.

### Task 7: E2E Playwright

**Files:**

- Create: `apps/web/e2e/informes.spec.ts` (seguir setup/helpers de los specs del panel existentes en `apps/web/e2e/`)

- [ ] **Step 1: Leer los specs E2E del panel existentes** para reutilizar login/seed/fixtures.
- [ ] **Step 2: Spec**: como Admin Org con ciclo que tiene resultados (fixtures E2E existentes): (a) genera informe 7.9 → aparece en la tabla con sha256; (b) descarga → la respuesta es un PDF (content-type/magic bytes); (c) genera expediente → aparece; (d) verifica en BD (helper service_role del setup E2E) eventos `informe_generado` y `informe_descargado` en `audit_log`; (e) el consultor de OTRA empresa no ve la página (aislamiento).
- [ ] **Step 3: Correr E2E local** (`pnpm --filter web e2e` o el script que exista) hasta verde.
- [ ] **Step 4: Commit** — `E2E: generación y descarga auditada de informe 7.9 y expediente`.

### Task 8: Cierre — CLAUDE.md, verificación completa y PR

- [ ] **Step 1:** `pnpm lint && pnpm typecheck && pnpm test` verdes en todo el repo; suite RLS verde; E2E verdes.
- [ ] **Step 2:** Actualizar tabla de milestones de CLAUDE.md: M5 ✅ con resumen (informe 7.9 PDF, expediente ZIP con manifiesto sha256, bucket informes, auditoría de generación/descarga, E2E).
- [ ] **Step 3:** Commit — `Cierra Milestone 5: informe 7.9 y expediente de inspección` — push y PR draft `milestone-5` → `main`.

## Self-Review (hecho al redactar)

- Cobertura: a–g del 7.9 → Tasks 2–3; expediente → Task 5; integridad/auditoría → Tasks 4–5; UI → Task 6; gates → Tasks 7–8. Sin huecos detectados.
- Tipos: `DatosInforme79` definido en Task 2 y consumido con el mismo nombre en Tasks 3–5.
- Riesgo señalado: compatibilidad `@react-pdf/renderer` con React 19 — verificar en Task 3 Step 1 y hay plan B (`pdf-lib`).
- Pendiente de verificación en código real (Step 1 de Tasks 2 y 7): firmas exactas de `agregados.ts` y helpers E2E.
