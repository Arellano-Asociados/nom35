# CLAUDE.md — Plataforma SaaS de Cumplimiento NOM-035-STPS-2018

Memoria persistente del proyecto. **Leer completo antes de trabajar en cualquier sesión.**

## 1. Qué es este producto

MVP de una plataforma SaaS **multi-tenant** que digitaliza el cumplimiento de la
**NOM-035-STPS-2018** (factores de riesgo psicosocial en el trabajo, México). La norma obliga a
todos los centros de trabajo a aplicar cuestionarios oficiales (Guías de Referencia I, II y III
del DOF 23-oct-2018), procesarlos con matrices definidas en la propia norma, determinar niveles
de riesgo, tomar acciones y conservar **evidencia documental exhibible ante inspecciones de la
STPS** (evidencia electrónica válida; multas de 250 a 5,000 UMA por infracción, art. 994-V LFT).

Ciclo completo que automatiza la plataforma: registro de empresas/centros de trabajo/empleados →
distribución de cuestionarios por enlace tokenizado → captura inmutable de respuestas → cálculo
automático con matrices oficiales → dashboards agregados → informe normativo (numeral 7.9) y
expediente de inspección descargable.

**Diferenciador central:** evidencia auditable e inmutable (el producto NO permite editar
respuestas ni resultados jamás) y arquitectura multi-empresa pensada también para consultoras
que atienden múltiples clientes.

- Segmento inicial: empresas de 101–500 empleados. Meta año 1: ~200 organizaciones.
- Los resultados de los cuestionarios son **DATOS PERSONALES SENSIBLES (salud)** bajo la
  LFPDPPP vigente (DOF 20-mar-2025; autoridad: Secretaría Anticorrupción y Buen Gobierno).
  Esto gobierna el diseño de permisos: nadie del lado patronal ve respuestas crudas nunca; los
  resultados individuales procesados solo los ve un "Responsable Designado" con cada consulta
  auditada.

## 2. Stack y arquitectura (decisión cerrada — NO reabrir)

- **Next.js 15 (App Router, TypeScript) + Supabase** (PostgreSQL con Row Level Security, Auth
  con magic links, Storage) + Tailwind + shadcn/ui. Deploy objetivo: Vercel + Supabase Pro.
- Motor de cálculo como **paquete TypeScript puro sin dependencias de framework** en
  `packages/motor-nom035`, consumido por la app. Razón: el riesgo dominante es corrección
  normativa y aislamiento de datos; el motor aislado se valida exhaustivamente y es portable;
  RLS garantiza aislamiento a nivel de BD independiente del código.
- Correo transaccional vía Resend (o equivalente) detrás de una interfaz `MailProvider`.

### Estructura del monorepo (pnpm workspaces)

```
apps/web/               # Next.js 15 (se scaffoldea en Milestone 3; hasta entonces, stub)
packages/motor-nom035/  # Motor de cálculo puro (funciones puras, sin I/O, sin framework)
supabase/               # Migraciones SQL, políticas RLS, seeds (Supabase CLI)
.github/workflows/      # CI: lint + typecheck + tests como gates
```

## 3. REGLAS DE NEGOCIO INVIOLABLES

Estas reglas no admiten excepciones, flags de configuración ni "casos especiales":

1. **Inmutabilidad:** `responses` y `risk_results` son INMUTABLES: append-only, nunca
   UPDATE/DELETE; recálculo = fila nueva con `supersedes_id`. Triggers en BD rechazan
   modificaciones.
2. **Sin promedios:** los resultados NUNCA se promedian entre empleados. Agregados =
   distribuciones y conteos.
3. **Anti-reidentificación:** toda vista agregada suprime celdas con **n < 3**.
4. **Respuestas crudas: nadie patronal.** Ningún rol patronal (Admin Org, Consultor,
   Responsable Designado, Admin Plataforma) puede leer respuestas crudas ítem por ítem.
   Sin excepciones, sin flags.
5. **Resultados individuales procesados:** solo el Responsable Designado; cada consulta genera
   evento `individual_result_access` en `audit_log` (append-only).
6. **Tenancy:** `company_id` se deriva SIEMPRE del JWT, jamás del request. Toda tabla de tenant
   tiene RLS activo. Los tests de aislamiento entre tenants son **gate de CI**.
7. **Nada normativo hardcodeado:** matrices y rangos viven en TABLAS DE DATOS
   (`scoring_rules`, `item_structure`, `risk_level_ranges`), nunca en el código del motor.
8. **Categoría normativa** de un centro de trabajo derivada de su headcount con umbrales
   15/16 y 50/51: ≤15 → solo GR-I; 16–50 → GR-I+GR-II; >50 → GR-I+GR-III.
9. **Logs limpios:** prohibido loggear respuestas o resultados en logs de aplicación.
   Prohibido hardcodear secretos (solo variables de entorno; `.env` en `.gitignore`).

### Reglas normativas clave del motor (resumen; detalle en seeds/tablas)

- **GR-III** (72 ítems, centros >50): Grupo A puntúa directo (Siempre=0 … Nunca=4), Grupo B
  inverso (Siempre=4 … Nunca=0). Cfinal: Nulo <50 | Bajo <75 | Medio <99 | Alto <140 |
  Muy alto ≥140. Rangos propios por categoría y por dominio (ver `risk_level_ranges`).
- **GR-II** (46 ítems, centros 16–50): Grupo A = ítems 18–33; Grupo B = 1–17 y 34–46.
  Cfinal: <20/<45/<70/<90/≥90.
- **GR-I** (todas las empresas, Sí/No, sin puntaje): Sección I = exposición a acontecimiento
  traumático severo; si TODAS No → no requiere valoración. Si ALGUNA Sí → secciones II–IV.
  Requiere valoración clínica si: ≥1 Sí en Sección II, o ≥3 Sí en Sección III, o ≥2 Sí en
  Sección IV. Resultado binario + canalización.
- **Ítems condicionales:** GR-III: 65–68 solo si atiende clientes/usuarios; 69–72 solo si
  supervisa personal. GR-II: 41–43 clientes; 44–46 supervisión. Si no aplican, se registran
  como "Nunca" (=0, son Grupo B).
- **Regla de niveles compartida:** puntaje < nulo_max → Nulo; < bajo_max → Bajo;
  < medio_max → Medio; < alto_max → Alto; ≥ alto_max → Muy alto.

## 4. Convenciones

- **Commits atómicos** con mensajes descriptivos **en español**. Una rama por milestone.
- **TDD estricto en el motor** (test primero, luego implementación). Unit + integración en el
  resto; E2E (Playwright) para flujos críticos.
- Migraciones SQL versionadas y reproducibles desde cero; seeds idempotentes.
- Componentes con shadcn/ui; UI íntegramente en **es-MX**, responsive y accesible (labels,
  contraste, navegación por teclado en el cuestionario).
- Lint + typecheck sin warnings. Gates de CI innegociables: lint, typecheck, suite del motor,
  tests de aislamiento multi-tenant.
- TypeScript estricto en todos los paquetes (`tsconfig.base.json`).

### Comandos

```bash
pnpm lint        # ESLint + Prettier check (todo el repo)
pnpm typecheck   # tsc --noEmit en todos los workspaces
pnpm test        # Vitest en todos los workspaces (--if-present)
pnpm exec supabase start   # Supabase local (requiere Docker Desktop)
pnpm exec supabase db reset # Re-aplica migraciones + seeds desde cero
```

## 5. Estado de milestones

| Milestone | Descripción | Estado |
|---|---|---|
| M0 | Init repo, monorepo, CLAUDE.md, CI, Supabase local | ✅ Cerrado (pendiente: verificar `supabase start` con Docker Desktop instalado) |
| M1 | Motor de cálculo + suite de validación (antes de cualquier UI) | ⬜ Pendiente |
| M2 | Base de datos, multi-tenancy y auth (RLS + tests de aislamiento) | ⬜ Pendiente |
| M3 | Flujo del empleado (primera UI) + captura inmutable | ⬜ Pendiente |
| M4 | Panel administrativo | ⬜ Pendiente |
| M5 | Informe 7.9 y expediente de inspección | ⬜ Pendiente |
| M6 | Endurecimiento y demo | ⬜ Pendiente |

### Dependencias externas abiertas

- **Validación de lanzamiento del motor pendiente de datos de consultor:** existirán 3–5
  cuestionarios resueltos y validados por un consultor certificado NOM-035 (en gestión, aún no
  disponibles). Se cargarán en `packages/motor-nom035/reference-cases/` (formato JSON
  documentado ahí). Un test marcado `todo` falla en modo "release" si el directorio está
  vacío. Criterio final: coincidencia 100%. Mientras tanto, M1 se cierra "para desarrollo" con
  los casos 1–11 en verde + verificación cruzada manual de 2 casos mixtos contra Evalúa035 de
  CONTPAQi (documentada en `reference-cases/README.md`).

### Orden estricto

No se escribe ni una línea de frontend hasta cerrar el Milestone 1 (motor validado).
Al cerrar cada milestone: detenerse, resumir lo construido, actualizar este archivo y esperar
confirmación antes de continuar.
