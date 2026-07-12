# Milestone 6 — Endurecimiento y demo: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la cola de endurecimiento del triaje de M5 (consistencia de datos, anti-reidentificación reforzada, hardening de CSVs, auditoría fail-closed) y dejar la plataforma lista para demo con datos semilla realistas y guion.

**Architecture:** Cambios quirúrgicos sobre módulos existentes (`agregados.ts`, `dashboard/page.tsx`, `expediente.ts`, página individual del RD, `informe-79-pdf.tsx`) reutilizando los criterios ya probados (filtro de vigentes de `informe.ts`, helper de auditoría). El seed de demo es un script Node independiente con service_role, idempotente, que ejercita el flujo real (motor incluido) sin tocar la app.

**Tech Stack:** El existente (Next.js 15, Supabase, Vitest, Playwright). Sin dependencias nuevas.

## Global Constraints

- Reglas inviolables de CLAUDE.md §3, en particular: inmutabilidad append-only; sin promedios; supresión n<3; respuestas crudas jamás patronales; `individual_result_access` en CADA consulta del RD; tenancy por membresía verificada; nada normativo hardcodeado; logs limpios.
- TDD: test primero en todo cambio de lógica. Lint + typecheck sin warnings. Commits atómicos en español.
- Windows: no reescribir fuentes con Get-Content/Set-Content de PowerShell 5.1.
- Sin Docker en el entorno de desarrollo: la suite RLS y los E2E se verifican en CI; los unit tests, lint y typecheck se verifican localmente.
- No cambiar `data-testid` existentes (los E2E dependen de ellos).

---

### Task 1: Dashboard alineado al filtro de vigentes (`supersedes_id`) — PRIORIDAD

**Files:**

- Modify: `apps/web/src/lib/informe.ts` (exportar el filtro de vigentes)
- Modify: `apps/web/src/app/panel/[empresa]/ciclos/[ciclo]/dashboard/page.tsx`
- Test: `apps/web/src/lib/informe.test.ts` (ya cubre el filtro; agregar caso si la exportación cambia la firma)

**Interfaces:**

- Produces: `resultadosVigentesPorAsignacion(resultados)` exportada desde `lib/informe.ts` (hoy es función privada; misma lógica, sin cambios de comportamiento).
- El dashboard consume la función exportada sobre las filas que ya trae (agregar `id, assignment_id, supersedes_id, created_at` a su select si le faltan columnas) ANTES de agregar distribuciones.

**Motivación:** el informe 7.9 filtra resultados vigentes; el dashboard agrega el historial completo. Con cualquier recálculo futuro, ambos mostrarían distribuciones distintas del mismo ciclo — discrepancia visible ante un inspector.

- [ ] Exportar `resultadosVigentesPorAsignacion` (y su tipo de entrada mínimo) desde `lib/informe.ts`; typecheck verde.
- [ ] Leer `dashboard/page.tsx`; ajustar el select de `risk_results` para incluir las columnas del filtro y aplicar el filtro antes de `distribucionNiveles`/`distribucionPorNombre`.
- [ ] Los tests existentes de `informe.test.ts` siguen verdes (la función no cambia de comportamiento, solo de visibilidad).
- [ ] Commit: `Dashboard: agrega solo resultados vigentes (supersedes_id), mismo criterio que el informe 7.9`.

### Task 2: Supresión complementaria en distribuciones

**Files:**

- Modify: `apps/web/src/lib/agregados.ts`
- Test: `apps/web/src/lib/agregados.test.ts`

**Decisión (documentar en el código y en el PR):** cuando en una distribución con total visible queda EXACTAMENTE UNA celda suprimida, su valor es recuperable por resta. Regla complementaria: suprimir también la celda no-suprimida de menor `n` positivo (práctica estándar de control de divulgación estadística). Aplica dentro de `distribucionNiveles` y `distribucionPorNombre` (por nombre, dentro de cada grupo), con lo que dashboard, informe PDF y cualquier consumidor futuro quedan protegidos a la vez.

- [ ] Tests que fallan: (a) distribución 3 nulo / 1 alto (total 4): hoy `alto` se suprime y `nulo` queda visible → con la regla, `nulo` también se suprime (marcada `suprimida: true`, `n: null`); (b) dos celdas ya suprimidas (1 y 2) + una visible (5): NO se suprime nada adicional (la resta solo revela la suma de las dos, no cada una); (c) ninguna suprimida: sin cambios; (d) una suprimida y las demás en 0: las de 0 no revelan nada por resta... verificar el razonamiento: total 1, una celda n=1 suprimida, resto 0 visibles → la suprimida ES recuperable (total − 0 = 1); en ese caso el total del grupo también debe ocultarse o la celda de 0 con mayor plausibilidad suprimirse — resolver suprimiendo el TOTAL del grupo cuando no exista celda complementaria positiva que suprimir, y cubrirlo con test.
- [ ] Implementar en `agregados.ts` como post-proceso de las distribuciones (una sola función `aplicarSupresionComplementaria` reutilizada por ambas).
- [ ] Tests verdes, incluidos los preexistentes de informe/expediente (las cabeceras de CSVs no cambian; el PDF ya renderiza `suprimida` como "— (n<3)").
- [ ] Actualizar la regla 3 de CLAUDE.md con una línea: la supresión incluye complementaria para impedir recuperación por resta.
- [ ] Commit: `Agregados: supresión complementaria para impedir recuperación por resta (TDD)`.

### Task 3: Hardening de CSVs contra formula injection

**Files:**

- Modify: `apps/web/src/informes/expediente.ts` (`escaparCampoCsv`)
- Test: `apps/web/src/informes/expediente.test.ts`

- [ ] Tests que fallan: campos que inician con `=`, `+`, `-`, `@` (p. ej. nombre `=HYPERLINK(...)`) se neutralizan anteponiendo `'` (apóstrofo, convención de Excel) ADEMÁS del entrecomillado RFC 4180 cuando aplique; campos normales no cambian; fechas ISO que inician con dígito no se tocan.
- [ ] Implementar en `escaparCampoCsv`.
- [ ] Tests verdes (ajustar fixtures existentes si alguna cabecera/valor esperado cambia — las cabeceras no inician con esos caracteres, no deberían cambiar).
- [ ] Commit: `Expediente: neutraliza formula injection en campos CSV (TDD)`.

### Task 4: Auditoría fail-closed del acceso individual del RD

**Files:**

- Modify: `apps/web/src/app/panel/[empresa]/ciclos/[ciclo]/individual/[empleado]/page.tsx`
- Modify: `apps/web/src/lib/auditoria.ts` (variante que reporta éxito)

**Interfaces:**

- Produces: `registrarAuditoriaEstricta(...): Promise<boolean>` en `lib/auditoria.ts` (misma firma que `registrarAuditoria` pero devuelve `false` si el INSERT falló, sin lanzar). `registrarAuditoria` (fire-and-forget) se conserva para los call sites existentes.
- La página individual usa la variante estricta: si el evento `individual_result_access` NO pudo registrarse, NO se muestra el resultado (render de error es-MX: "No fue posible registrar la consulta en la bitácora; el resultado no puede mostrarse"). Regla inviolable 5: cada consulta genera evento — sin evento, no hay consulta.

- [ ] Implementar `registrarAuditoriaEstricta` reutilizando el cuerpo actual (sin duplicar: extraer el insert a una función interna compartida).
- [ ] Migrar el insert directo de la página individual (hoy sin manejo de error) a la variante estricta con el render fail-closed.
- [ ] Typecheck/lint verdes; los E2E existentes del panel (que ejercitan el interstitial y verifican el evento en BD) deben seguir pasando en CI.
- [ ] Commit: `RD: acceso individual fail-closed si la auditoría no puede registrarse`.

### Task 5: Pulido del informe PDF y acuses

**Files:**

- Modify: `apps/web/src/informes/informe-79-pdf.tsx` (fecha es-MX en pie)
- Modify: `apps/web/src/informes/expediente.ts` + `apps/web/src/acciones/informes.ts` (título/versión de política en acuses)
- Test: `apps/web/src/informes/expediente.test.ts`

- [ ] PDF: formatear `generadoEl` en el pie con `Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' })` al renderizar (el dato sigue siendo ISO); smoke test sigue verde.
- [ ] Acuses: `EntradaAcusePolitica` gana `tituloPolitica: string` y `versionPolitica: string`; cabecera de `acuses-politica.csv` pasa a `empleado,politica,version,fecha_acuse`; la acción resuelve título/versión con un join a `policies` (columnas reales en la migración). Test de frontera actualizado con la cabecera exacta nueva (sigue sin nada de resultados).
- [ ] Revisar si `apps/web/e2e/informes.spec.ts` asierta cabeceras de ese CSV (grep) y ajustar si aplica.
- [ ] Commit: `Informe/expediente: fecha es-MX en pie del PDF y política identificada en acuses (TDD)`.

### Task 6: Seed de demo y guion

**Files:**

- Create: `scripts/demo-seed.mjs` (raíz del repo; Node puro + `@supabase/supabase-js` service_role + `pg` si hace falta, reutilizando el patrón de `apps/web/e2e/global-setup.ts`)
- Create: `docs/demo.md`
- Modify: `package.json` raíz (script `demo:seed`)

**Comportamiento del seed (idempotente por nombre; NO corre en producción — exige `NEXT_PUBLIC_SUPABASE_URL` local o `DEMO_ALLOW=1`):** crea (si no existen) una empresa "Empresa Demo NOM-035" con: un centro >50 (GR-I+GR-III) y un centro de 16–50 (GR-I+GR-II); ~30 empleados con áreas variadas; un ciclo con evaluador; asignaciones distribuidas; respuestas y resultados generados VÍA EL MOTOR REAL (`calificarCuestionario`/`evaluarGR1` del paquete `@nom35/motor-nom035`) con patrones variados (niveles nulo→muy alto, algún GR-I que requiere valoración), insertados con service_role respetando el esquema append-only; una política publicada con algunos acuses; capacitación con registros; acciones de la Tabla 7. Cuenta admin demo `admin@demo.nom035.mx` / contraseña documentada en `docs/demo.md`.

- [ ] Leer `apps/web/e2e/global-setup.ts` y `packages/pruebas-rls/src/fixtures.sql` para reutilizar convenciones de inserción (hash de tokens, filters_captured_at, etc.).
- [ ] Implementar `scripts/demo-seed.mjs` idempotente + script npm `demo:seed`.
- [ ] `docs/demo.md`: guion de demo de 10 minutos (login admin → empresa → centros → empleados → ciclo → distribución → dashboard con supresión → informes/expediente → RD e interstitial auditado), credenciales, y cómo resetear (`supabase db reset` + `pnpm demo:seed`).
- [ ] Verificación local imposible sin Docker: validar sintaxis con `node --check`, lint, typecheck; documentar en el reporte que la primera corrida real requiere Supabase local. NO agregar el seed a CI.
- [ ] Commit: `Demo: seed idempotente con datos realistas via motor real + guion de demo`.

### Task 7: Cierre — CLAUDE.md, verificación y PR

- [ ] `pnpm lint && pnpm typecheck && pnpm test` verdes en todo el repo.
- [ ] Actualizar CLAUDE.md: M6 ✅ con resumen; limpiar la sección "Cola de endurecimiento para M6" (movida a hechos); dejar constancia de lo que queda fuera (validación de lanzamiento del motor con casos del consultor — dependencia externa; `supabase start` local — requiere Docker del lado del usuario).
- [ ] Commit `Cierra Milestone 6: endurecimiento y demo`, push, PR draft `milestone-6` → `main`.

## Self-Review

- Cobertura vs. cola de M6 en CLAUDE.md: dashboard ✔ (T1), supresión complementaria ✔ (T2), formula injection ✔ (T3), individual_result_access ✔ (T4), fecha es-MX ✔ (T5), acuses con política ✔ (T5), demo ✔ (T6). Fuera de alcance documentado: validación externa del motor, Docker local.
- Decisiones autónomas que el PR debe destacar para revisión del usuario: la regla de supresión complementaria (T2, extiende la regla 3) y el fail-closed del acceso individual (T4, endurece la regla 5).
- Tipos: `resultadosVigentesPorAsignacion` se exporta sin cambio de firma; `EntradaAcusePolitica` gana dos campos string.
