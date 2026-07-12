# Milestone 7 — Manual y UI premium: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manual de uso completo con diagramas (flujo y secuencia) y rediseño visual premium de toda la UI (tipografía, menú lateral, toasts, tablas/badges/estados vacíos, flujo del empleado) sin romper un solo E2E ni regla de negocio.

**Architecture:** El rediseño es CSS/estructura de presentación: no se toca ninguna acción de servidor, query, ni lógica de autorización. Fundación primero (fuente, tokens, shell con sidebar), luego capas (toasts, pulido del panel, pulido del flujo del empleado). El manual es un doc es-MX con diagramas mermaid (los renderiza GitHub).

**Tech Stack:** El existente (Next.js 15, Tailwind, shadcn/ui) + `next/font` (fuente vía Google Fonts, self-hosted por Next) + `sonner` (toasts, patrón shadcn). Sin más dependencias.

## Global Constraints (INNEGOCIABLES en cada tarea)

- **No romper E2E**: los specs (`apps/web/e2e/*.spec.ts`) asiertan textos exactos ("Mis empresas", "Aviso de privacidad y consentimiento", "Antes de comenzar", "Cuestionario GR-II", "Sección N de M", "X / Y respondidas", etiquetas de botones "Ingresar"/"Crear cuenta"/"Crear empresa"/"Crear centro"/"Agregar empleado"/"Crear ciclo"/"Comenzar cuestionario"/opciones Likert), roles (radio, checkbox, alert), labels de formularios y TODOS los `data-testid`. Antes de cambiar cualquier página, grep de sus textos/testids en `apps/web/e2e/`; cualquier cambio de copy que un spec asierta exige actualizar el spec en el MISMO commit y correr el E2E local.
- **E2E local obligatorio al final de cada tarea de UI**: Supabase local está corriendo (Docker disponible). `pnpm --filter @nom35/web test:e2e` (usa puerto 3100, no choca con el dev server de 3000). PATH de Docker: `C:\Program Files\Docker\Docker\resources\bin`.
- Accesibilidad es-MX (CLAUDE.md): labels, contraste AA, navegación por teclado; el color NUNCA es el único portador de significado (badges de nivel llevan texto siempre).
- Componentes cliente jamás en carpetas con corchetes. `pnpm lint`/`typecheck` sin warnings. Commits atómicos en español.
- Los agregados/supresión/reglas inviolables no se tocan: esto es presentación.
- Windows: no reescribir fuentes con Get-Content/Set-Content de PowerShell 5.1.

## Decisiones de diseño (tomadas; documentar en código donde aplique)

- **Tipografía**: `Inter` (variable, `next/font/google`, subset latin) como fuente única de UI, con `font-feature-settings` para números tabulares en tablas/cifras. Escala tipográfica consistente (títulos
  `text-2xl/xl/lg` semibold con `tracking-tight`, cuerpo `text-sm`, metadatos `text-xs`).
- **Paleta**: se mantiene la base `slate` + acento azul actual (`blue-700`), formalizada: fondo app `slate-50`, superficies blancas con `border-slate-200` + sombra sutil, foco visible `outline-blue-600`. Niveles de riesgo con badges texto+color AA: nulo=emerald, bajo=lime, medio=amber, alto=orange, muy alto=red (tonos `-100` fondo / `-800` texto — verificar contraste).
- **Shell del panel**: sidebar lateral fijo en desktop (≥lg) con logo, navegación de la empresa activa (Centros/Empleados/Equipo/Política/Capacitación/Ciclos), sección inferior con usuario y "Salir"; en móvil colapsa a un drawer con botón hamburguesa accesible. Dentro de un ciclo, las subpestañas (Dashboard/Acciones/GR-I/Individuales/Informes) se vuelven navegación secundaria horizontal pegajosa. Las URLs no cambian.
- **Toasts**: `sonner` (`<Toaster richColors position="top-right" />` en el layout del panel). ADITIVOS: los mensajes inline `role="alert"` y `*-detalle` que los E2E asiertan se conservan; el toast es la señal inmediata premium encima.
- **Flujo del empleado**: opciones Likert como "cards" seleccionables grandes (el input radio sigue presente y accesible — los E2E hacen click por texto y asiertan `toBeChecked`), barra de progreso pegajosa, transición suave entre secciones, pantalla de resultado con jerarquía clara. Textos EXACTOS intactos.

---

### Task 1: Enlace "Acceso administrativo" en la raíz — ✅ HECHA (commit 2063eef, inline por el controlador)

### Task 2: Manual de uso con diagramas

**Files:** Create: `docs/manual.md`. Modify: `CLAUDE.md` (referencia en Comandos/nota), `docs/demo.md` (enlace cruzado al manual).

Contenido requerido de `docs/manual.md` (es-MX, tono claro y directo, apto para alguien no técnico):

- [ ] **Qué es y cómo funciona** (2-3 párrafos + diagrama mermaid `flowchart` del ciclo completo: alta empresa → centros → empleados → ciclo → distribución → empleado responde → motor califica → dashboard → informe 7.9/expediente → inspección).
- [ ] **Diagrama de secuencia** (mermaid `sequenceDiagram`) del flujo del empleado: correo → enlace tokenizado → consentimiento → filtros → respuestas (guardado incremental) → envío → motor → resultado propio + del acceso del RD (interstitial → evento de auditoría → resultado).
- [ ] **Guía del Administrador** ("cómo sacarle el mayor provecho"): paso a paso con las rutas reales de la UI, incluyendo importación CSV (formato exacto de columnas, leerlo de `csv-empleados.ts`), recordatorios, lectura del dashboard (qué significa la supresión "— (n<3)" y por qué es un feature, no un bug), acciones Cap. 8, política y acuses, capacitación, generación y descarga de informe/expediente, y qué rol ve qué (tabla de permisos Admin Org / Consultor / RD / empleado).
- [ ] **Guía del empleado** (explicada "como a un niño": el enlace es un boleto único; nadie de tu empresa puede ver tus respuestas; puedes cerrar y volver; corrige antes de enviar; tu resultado es tuyo).
- [ ] **Prueba end-to-end en local**: consolidar el recorrido — prerrequisitos (referir a docs/demo.md), sembrar, recorrido admin completo, responder un cuestionario con un token pendiente, verlo reflejado en dashboard/informe, y cómo verificar la auditoría (query de ejemplo vía Studio en `http://127.0.0.1:54323`).
- [ ] **Preguntas frecuentes** (mínimo: ¿por qué no puedo ver respuestas individuales?, ¿por qué hay celdas ocultas?, ¿qué pasa si un empleado pierde su enlace? (recordatorios rotan token), ¿cada cuándo se reevalúa? (2 años, numeral 7.9), ¿qué le muestro a un inspector?).
- [ ] Validar que los diagramas mermaid rendericen (sintaxis correcta), prettier limpio, commit.

### Task 3: Fundación visual — tipografía, tokens y shell con sidebar

**Files:** Modify: `apps/web/src/app/layout.tsx` (fuente Inter + fondo), `apps/web/src/app/panel/layout.tsx` y `apps/web/src/app/panel/[empresa]/layout.tsx` (nuevo shell), `apps/web/src/app/globals.css` (tokens/focus). Create: `apps/web/src/components/panel/sidebar.tsx` (+ drawer móvil, client component), `apps/web/src/components/panel/navegacion-ciclo.tsx` si conviene extraer las subpestañas.

- [ ] `next/font/google` Inter en el layout raíz (`variable: '--font-sans'`, wire a Tailwind `fontFamily.sans`); números tabulares utilitarios para tablas.
- [ ] Shell: sidebar desktop + drawer móvil accesible (botón con `aria-expanded`, foco atrapado o cierre con Escape — usar el patrón más simple correcto), header con nombre de empresa activa y "Salir" (el botón existente `boton-salir.tsx` se reutiliza). La navegación actual por pestañas del layout de empresa se muda al sidebar; las subpáginas del ciclo quedan como nav secundaria. URLs idénticas.
- [ ] Grep previo de textos/testids de navegación en E2E (`panel-admin.spec.ts` navega con `page.goto(...replace('/centros','/empleados'))` y clicks por texto como 'Dashboard agregado' — conservar esos textos como enlaces visibles).
- [ ] Estados de foco visibles global (`globals.css`), contraste AA del sidebar.
- [ ] `pnpm lint && pnpm typecheck` + **E2E local completo verde** + commit.

### Task 4: Toasts premium (sonner) sin romper aserciones

**Files:** `pnpm --filter web add sonner`. Modify: layout del panel (`<Toaster/>`), `boton-accion.tsx`, `generar-informe.tsx`, `importador-csv.tsx`, `formulario-equipo.tsx`, `selector-canalizacion.tsx`, `registro-capacitacion.tsx` (los client components con acciones).

- [ ] Toast de éxito/error en cada acción (es-MX específico: "Cuestionarios distribuidos", "Informe 7.9 generado", etc.). Los mensajes inline `role="alert"`/`*-detalle` existentes SE CONSERVAN (E2E los asierta).
- [ ] Revisar que `<Toaster/>` no intercepte clicks/overlays que confundan a Playwright (position top-right, sin modal).
- [ ] Lint/typecheck + **E2E local verde** + commit.

### Task 5: Pulido premium del panel

**Files:** páginas del panel (`page.tsx` de empresas/centros/empleados/equipo/politica/capacitacion/ciclos/ciclo/dashboard/acciones/gr1/individual/informes) y `tabla-distribucion.tsx` — solo presentación.

- [ ] Tablas: cabeceras `text-xs uppercase tracking-wide text-slate-500`, filas con hover, números tabulares, alineación numérica derecha.
- [ ] Badges de nivel de riesgo (texto + color AA según la paleta de decisiones) en dashboard/individual/acciones; celdas suprimidas con badge neutro "— (n<3)" + `title` explicativo.
- [ ] Estados vacíos con icono/texto guía y CTA (p. ej. "Aún no hay centros — crea el primero").
- [ ] Formularios: inputs consistentes (focus ring, tamaños), botones con jerarquía primario/secundario.
- [ ] Dashboard: tiles de resumen arriba (participación, completados, nivel predominante — solo datos ya calculados, nada nuevo de negocio), tablas de distribución con los badges.
- [ ] Grep de testids/textos por página ANTES de tocarla; lint/typecheck + **E2E local verde** + commit (puede ser 2-3 commits atómicos por grupos de páginas).

### Task 6: Pulido premium del flujo del empleado

**Files:** `consentimiento.tsx`, `filtros.tsx`, `cuestionario.tsx`, `politica.tsx`, `resultado` (en `responder/[token]/page.tsx`), landing raíz — solo presentación.

- [ ] Likert como cards seleccionables (input radio real intacto, click por texto de la opción sigue funcionando, `toBeChecked` sigue pasando), touch targets ≥44px, sección activa con transición suave.
- [ ] Barra de progreso pegajosa con porcentaje; textos EXACTOS del contador y "Sección N de M" intactos (E2E).
- [ ] Consentimiento y filtros: cards centradas premium; checkbox/radios accesibles intactos.
- [ ] Resultado: jerarquía clara (nivel con badge grande, categorías/dominios en tabla pulida); textos que el E2E asierta ('calificación final 64', testids `nivel-final`, `resultado-likert`, `confirmacion`) intactos.
- [ ] Lint/typecheck + **E2E local completo verde** (las 3 guías + panel + informes) + commit.

### Task 7: Cierre — verificación total, CLAUDE.md, PR

- [ ] `pnpm lint && pnpm typecheck && pnpm test` + suite RLS local (`pnpm --filter @nom35/pruebas-rls test:rls`) + E2E local completo — todo verde.
- [ ] CLAUDE.md: fila M7 ✅ en la tabla (manual + rediseño premium), nota de fuente/toasts en convenciones si aplica.
- [ ] Commit cierre, push, PR draft `milestone-7` → `main`, CI verde, merge (flujo autónomo).

## Self-Review

- Riesgo #1 (E2E) mitigado con: grep previo por página, conservación de textos/testids como restricción dura, y E2E local obligatorio por tarea — ahora posible con Docker.
- El manual (T2) no depende de la UI nueva; sus capturas son textuales/diagramas, no screenshots, así que no queda obsoleto por T3-T6.
- Nada de lógica de negocio se toca; los diffs de T3-T6 deben ser 100% presentación (el revisor de cada tarea lo verifica).
