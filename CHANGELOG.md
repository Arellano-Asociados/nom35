# Changelog

Historia de Constata por fase, desde la línea base auditada hasta el MVP v1.0. Cada fila lleva
su etiqueta de git. El detalle técnico de cada milestone vive en
[docs/historia-milestones.md](docs/historia-milestones.md); el detalle de remediación de la
auditoría, en [docs/AUDITORIA.md](docs/AUDITORIA.md).

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/). Este proyecto no
usa SemVer clásico: las etiquetas marcan cortes de fase (`v0.x`) rumbo al `v1.0-mvp`.

## [v1.0-mvp] — 2026-07-15 · Documentación final y cierre

Fase 8: documentación de producto y cierre del MVP.

- **README.md** raíz: qué es Constata, stack, arranque local completo (Supabase, seed de demo,
  IA simulada sin API key), comandos, estructura del monorepo y tropiezos conocidos.
- **docs/MANUAL_USUARIO.md**: guía no técnica para el administrador de RH siguiendo el flujo
  real (registro → centros → empleados → política → ciclo → resultados → programa → expediente),
  con buzón, eventos traumáticos e IA asistida.
- **docs/ARQUITECTURA.md**: consolidación de módulos, modelo de datos, las cinco fronteras
  (RLS multi-tenant, supresión n<3, soporte, plataforma, IA), roles y decisiones selladas.
- **docs/DESPLIEGUE.md**: pasos a producción (Vercel + Supabase), variables de entorno,
  migraciones, respaldos y la **lista de bloqueo pre-producción** (dependencias externas).
- **CHANGELOG.md** (este archivo) y sección «Estado v1.0» en la auditoría.

Estado de validación: motor 59/59, web 202/202, RLS 91/91, E2E 29/29.

## [v0.9-demo-ready] — Fase 7 · Manual de QA y pulido de demo

Manual de QA con guion reproducible sobre el dataset de demo y sus verificaciones
automatizables (`scripts/qa-verificacion.mjs`); endurecimiento final de cara a la demostración
comercial.

## [v0.8-inteligencia] — 2026-07-15 · Fase 6 · Inteligencia y experiencia ejecutiva

Valor de producto sin abrir ninguna frontera de datos. Spec:
`docs/superpowers/specs/2026-07-14-fase-6-inteligencia-design.md`.

- **Dashboard ejecutivo** al entrar al panel (avance, semáforo, pendientes, vencimientos) sobre
  las vistas agregadas con supresión de fila completa.
- **Asistencia por IA** (resumen ejecutivo + plan de acción) detrás de `ProveedorIA`, con
  allow-list `lib/ia/ia-datos.ts`: la IA solo recibe agregados ya suprimidos, nunca respuestas
  ni resultados individuales.
- Anti prompt-injection estructural; `ai_drafts` append-only con la terna reproducible
  (insumo_sha256/prompt_version/modelo); borrador no adoptado inconfundible y no exportable.
- Flag `ia_asistida` (default OFF) + limitador de generación fail-closed por ciclo.

## [v0.7-portal-plataforma] — 2026-07-14 · Fase 5 · Portal de plataforma

Portal `/admin` para operar la plataforma (antes era SQL a mano con `service_role`). Spec con
7 decisiones selladas: `docs/superpowers/specs/2026-07-14-fase-5-portal-plataforma-design.md`.

- Identidad de plataforma por **fila real** en `platform_users` (sin claim JWT); exclusión dual
  operador↔tenant en BD; MFA TOTP forzado con frescura de 4h; `platform_audit_log` separada.
- Estados de organización: suspensión = **solo lectura en BD** (políticas RESTRICTIVE), baja con
  retención de 90 días, purga manual con acta de inventario.
- **Soporte con consentimiento nominativo** del cliente (grant ≤72h, revocable, **sin
  break-glass**); evento estricto por página; allow-list `lib/soporte-datos.ts`.
- Métricas cross-tenant solo operativas (vistas SQL, sin columna derivada de salud).

## [v0.6-norma-completa] — 2026-07-14 · Fase 4 + Fase 4.5 · Ciclo normativo completo

Cierra **toda la deuda normativa** de la dimensión 9. Specs:
`2026-07-13-fase-4-ciclo-normativo-design.md` y `2026-07-14-fase-4.5-remates-normativos-design.md`.

- **Difusión de resultados** (5.7 e / 7.8): constancia por ciclo, agregada, sellada y versionada,
  con acuse "Enterado" por token.
- **Buzón de quejas** (8.1 b): por empresa, sin sesión, anonimato a elección, folio+clave;
  contenido tratado como dato sensible.
- **Programa de intervención** (8.3–8.5): áreas sujetas, responsable, acciones con criterios
  literales de la Tabla 4/7, evidencia y avance; documento PDF con los seis incisos.
- **Eventos traumáticos** (5.3/5.5/6.5): GR-I solo a los expuestos, sin contar para la alerta
  bienal; registros 5.8 a) y c) exportables por el RD con auditoría fail-closed.
- **Informe 7.7** en toda la superficie (antes numerado 7.9), con objetivo, actividades, método
  del 7.4 e integración al diagnóstico de SST (NOM-030). Expediente ZIP completo con huellas
  SHA-256 y ausencias declaradas.

## [v0.5-ciclo-completo] — 2026-07-13 · Fase 3 · Configurabilidad

Cierra remates de la 2.5 y añade configurabilidad. Spec de fases.

- Cuestionarios personalizados (editor, publicado inmutable sellado, versionado, respuesta por
  token) sin tocar las guías oficiales (gate `verificar:textos` verde).
- Feature flags por organización bajo RLS; configuración de organización (logo validado por
  magic bytes, zona horaria, contacto); plantillas de comunicación editables con escape.
- Parámetros de ciclo: recordatorios automáticos por cron idempotente; caducidad de sesión.

## [v0.4-config] — 2026-07-13 · Fase 2.5 · Endurecimiento estructural

Migración fuera de `service_role`: el panel opera con `clienteSesion()` (**RLS real**), con
guardia de lint que impide `service_role` en `app/panel/**`. Límite de tasa en BD, Turnstile,
MFA TOTP, membresía real como única fuente de verdad del tenant. RLS 38 → 46.

## [v0.3-hardening] — 2026-07-13 · Fase 2 · Sistema de diseño e identidad Constata

Nombre e identidad **Constata** (`docs/BRAND.md`): logotipo/isotipo, favicon, design tokens,
correos con plantilla y remitente obligatorio. Cierra las dimensiones 1–4 de la auditoría y el
resto de accesibilidad (onboarding, breadcrumbs, selector multi-empresa, foco y ARIA).

## [v0.2-diseno] — 2026-07-13 · Fase 1.5 · Remediación de críticos de la auditoría

Cierra 8 de los 9 hallazgos críticos (el 9º, marca, se deja para la Fase 2):

- **Textos oficiales de los 138 ítems** del DOF + gate de CI (C-01).
- Corrección del cálculo GR-II ítems 18–19 (motor 0.2.0) (C-02).
- Supresión anti-reidentificación por **fila completa** (C-03).
- Escrituras que ya no tragan el error; errores de formulario visibles; foco de teclado visible
  en el cuestionario; aviso de privacidad versionado con sha256; canal ARCO público (C-04–C-08).

## [v0.1-criticos-cerrados] — 2026-07-13 · Corte intermedio de la Fase 1.5

Etiqueta de corte tras cerrar el primer lote de críticos de la auditoría.

## [v0-baseline] — 2026-07-12 · Línea base auditada (M0–M7)

Base construida en los milestones M0–M7 y auditada en `docs/AUDITORIA.md`:

- **M0** monorepo, CI, Supabase local. **M1** motor de cálculo puro + suite de validación.
- **M2** base de datos, multi-tenancy y auth (RLS). **M3** flujo del empleado + captura inmutable.
- **M4** panel administrativo. **M5** informe de resultados y expediente de inspección.
- **M6** endurecimiento y demo. **M7** manual de uso y UI premium.

La auditoría integral sobre este corte identificó 9 críticos, 32 altos, 41 medios y 24 bajos,
remediados en las fases posteriores.

[v1.0-mvp]: #v10-mvp--2026-07-15--documentación-final-y-cierre
[v0.9-demo-ready]: #v09-demo-ready--fase-7--manual-de-qa-y-pulido-de-demo
[v0.8-inteligencia]: #v08-inteligencia--2026-07-15--fase-6--inteligencia-y-experiencia-ejecutiva
[v0.7-portal-plataforma]: #v07-portal-plataforma--2026-07-14--fase-5--portal-de-plataforma
[v0.6-norma-completa]: #v06-norma-completa--2026-07-14--fase-4--fase-45--ciclo-normativo-completo
[v0.5-ciclo-completo]: #v05-ciclo-completo--2026-07-13--fase-3--configurabilidad
[v0.4-config]: #v04-config--2026-07-13--fase-25--endurecimiento-estructural
[v0.3-hardening]: #v03-hardening--2026-07-13--fase-2--sistema-de-diseño-e-identidad-constata
[v0.2-diseno]: #v02-diseno--2026-07-13--fase-15--remediación-de-críticos-de-la-auditoría
[v0.1-criticos-cerrados]: #v01-criticos-cerrados--2026-07-13--corte-intermedio-de-la-fase-15
[v0-baseline]: #v0-baseline--2026-07-12--línea-base-auditada-m0m7
