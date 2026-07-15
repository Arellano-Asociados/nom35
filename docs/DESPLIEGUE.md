# Despliegue a producción — Constata

Guía para llevar Constata a producción sobre **Vercel + Supabase**. Antes de los pasos técnicos,
lee la lista de bloqueo: hay dependencias **externas** que impiden un piloto con datos reales
por más que el software esté listo.

---

## ⛔ LISTA DE BLOQUEO PRE-PRODUCCIÓN

Estas tres dependencias **no son de ingeniería** y ninguna se puede cerrar desde el código.
Mientras alguna siga abierta, **no se puede correr un piloto con trabajadores reales**. La deuda
normativa del producto está vacía (auditoría cerrada); lo que queda es externo. Fuente:
[docs/AUDITORIA.md → «Deuda abierta reconocida»](AUDITORIA.md).

- [ ] **1. Validación del motor por consultor certificado NOM-035.**
      Cierra de forma definitiva el hallazgo C-02 (GR-II ítems 18–19) y la validación de
      lanzamiento de M1. Al recibir los 3–5 cuestionarios resueltos y validados, cargarlos en
      `packages/motor-nom035/reference-cases/` (formato documentado ahí). El test marcado `todo`
      **falla en modo release** si el directorio está vacío. Criterio de aceptación: **coincidencia
      100 %**. Es el camino crítico del proyecto.

- [ ] **2. Texto legal del aviso de privacidad + contrato de encargo (DPA).**
      Hoy el aviso es una **plantilla base** con campos `{{...}}`; redactarlo es trabajo de
      abogado. Cada empresa cliente es la **responsable** de los datos; Constata es la encargada.
      Se necesita: aviso de privacidad revisado por abogado y un DPA por cliente **antes de
      cualquier piloto con datos reales**. El DPA debe mencionar además el **subencargo del
      proveedor de IA** (Anthropic) si la organización activa la asistencia por IA.

- [ ] **3. Criterio legal de retención, bloqueo y disociación.**
      El canal ARCO existe; la **salida del dato** no. El periodo de retención exige criterio
      legal (art. 11 LFPDPPP frente a la obligación de conservación de la NOM-035). El diseño
      bloqueo + disociación es compatible con el append-only, pero requiere definir la política
      antes de operar con datos reales de trabajadores.

**Limitación de producto conocida (no bloquea el software, se declara):** la **inferencia
temporal sobre agregados en vivo** (consultar el dashboard antes/después de cada respuesta
revela el nivel de quien respondió) solo se cierra con instantáneas en lugar de agregados en
vivo — un cambio de producto, no un parche. Está documentada en `lib/agregados.ts` y en
[CLAUDE.md §3](../CLAUDE.md).

---

## 1. Requisitos de infraestructura

| Componente                   | Servicio                                            | Notas                                                      |
| ---------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Frontend + Server Actions    | **Vercel** (Next.js 15)                             | Región cercana a México; build de `apps/web`.              |
| Base de datos, Auth, Storage | **Supabase Pro**                                    | RLS activo, Auth con contraseña + TOTP, Storage para PDFs. |
| Correo transaccional         | **Resend** (o equivalente detrás de `MailProvider`) | Dominio verificado para `MAIL_FROM`.                       |
| Asistencia por IA (opcional) | **API de Anthropic**                                | Solo si se activa el flag `ia_asistida` por organización.  |
| Anti-abuso                   | **Cloudflare Turnstile**                            | En registro, login y ARCO.                                 |

## 2. Variables de entorno

Fuente de verdad y plantilla: [`apps/web/.env.example`](../apps/web/.env.example). En Vercel se
configuran como _Environment Variables_ del proyecto. **Nunca** se commitean valores reales
(`.env*` está en `.gitignore`; regla 9: secretos solo por entorno).

| Variable                                                  | Para qué                                                                                          | Obligatoria     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                | URL del proyecto Supabase                                                                         | Sí              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                           | Llave anónima (cliente, RLS aplica)                                                               | Sí              |
| `SUPABASE_SERVICE_ROLE_KEY`                               | Llave de servicio (solo servidor, usos justificados)                                              | Sí              |
| `SUPABASE_DB_URL`                                         | Cadena directa a Postgres (migraciones, cron)                                                     | Sí              |
| `NEXT_PUBLIC_APP_URL`                                     | URL pública (enlaces tokenizados, correos)                                                        | Sí              |
| `RESEND_API_KEY`                                          | Envío de correo en producción                                                                     | Sí              |
| `MAIL_FROM`                                               | Remitente con marca; **obligatorio en producción** (sin él, remitente de relleno = phishing/spam) | Sí              |
| `MAILPIT_URL`                                             | Bandeja local de desarrollo                                                                       | No (solo local) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Captcha no invasivo; sin llaves no se exige (dev/E2E)                                             | Recomendada     |
| `CRON_SECRET`                                             | Autentica los jobs de cron (recordatorios, retención)                                             | Sí              |
| `ANTHROPIC_API_KEY`                                       | Llamada a la IA desde el servidor                                                                 | Solo si hay IA  |
| `IA_MODELO`                                               | Modelo (`claude-haiku-4-5-20251001`)                                                              | Solo si hay IA  |
| `IA_SIMULADA`                                             | `1` → proveedor simulado (demo sin key); **jamás en producción**                                  | No              |

## 3. Base de datos y migraciones

Las migraciones de `supabase/migrations/` son **versionadas y reproducibles desde cero**; los
seeds normativos son idempotentes.

```bash
# Enlazar el proyecto de la nube y aplicar las migraciones
pnpm exec supabase link --project-ref <ref-del-proyecto>
pnpm exec supabase db push
```

Verificaciones **antes** de exponer el entorno:

- El hook `app.custom_access_token` está registrado como _Access Token Hook_ en Auth y corre
  como `supabase_auth_admin` con `GRANT USAGE ON SCHEMA app` + `GRANT EXECUTE`. **Sin esto,
  todo signup/login con contraseña falla con 500** (ni el flujo del empleado ni la suite RLS lo
  ejercitan — se detecta solo en el primer acceso al panel).
- MFA TOTP habilitado en Auth (el portal `/admin` lo exige).
- `pnpm verificar:textos` en verde: los 138 ítems oficiales no derivaron.
- Toda tabla de tenant tiene su GRANT explícito y sus políticas RLS (no hay default privileges).

Primer operador de plataforma (una vez por entorno, no hay registro público de `/admin`):

```bash
pnpm operador:crear operador@constata.mx "<contraseña-fuerte>"
```

## 4. Jobs programados (cron)

Configurar en Vercel Cron (o el scheduler que use el entorno), autenticados con `CRON_SECRET`:

- **Recordatorios automáticos de ciclo** (cada N días, decide por bitácora, idempotente).
- **Job de retención de organizaciones** (avisos 1/30/60/85 días antes de la purga de una baja).

Ambos son idempotentes y deciden por la bitácora: correrlos de más no duplica efectos.

## 5. Respaldos y retención de datos

- **Respaldos automáticos de Supabase Pro** (Point-in-Time Recovery). Verificar la ventana de
  retención del plan y probar una restauración antes del piloto.
- La **evidencia es inmutable** (append-only por trigger): un respaldo nunca debe usarse para
  "editar" datos, solo para recuperación ante desastre.
- La **purga física** de una organización dada de baja es **solo por script manual** con **acta
  de inventario** verificada antes de borrar (nunca automática). Ver la frontera de plataforma
  en [docs/ARQUITECTURA.md §5.4](ARQUITECTURA.md).
- El criterio de **retención/bloqueo/disociación** de datos de trabajadores está en la lista de
  bloqueo (pendiente legal): no operar con datos reales sin definirlo.

## 6. Despliegue de la aplicación (Vercel)

1. Conectar el repositorio; _Root Directory_ = raíz del monorepo (pnpm).
2. Build command efectivo: `pnpm --filter web build`. Output: `apps/web/.next`.
3. Configurar todas las variables de §2 en _Production_ (y _Preview_ si aplica).
4. Confirmar que los gates de CI pasan en `main` antes de promover:
   **lint, typecheck, motor, aislamiento RLS y E2E** son innegociables.
5. Tras el primer deploy: crear el operador de plataforma (§3), enrolar su TOTP y validar el
   flujo de registro de una empresa de prueba (ejercita el hook de Auth).

## 7. Verificación post-despliegue

- Registro de una empresa de prueba → confirma el hook de Auth y el claim `company_id`.
- Alta de un centro y un empleado, distribución de un ciclo → llega el correo con el enlace.
- El empleado responde → el dashboard refleja conteos (nunca respuestas crudas).
- Un grupo con n < 3 se enmascara por fila completa.
- Descarga del informe 7.7 y del expediente ZIP (huellas SHA-256 por archivo).
- Acceso a `/admin` con TOTP; un grant de soporte deja evento por página en la bitácora del
  tenant.

## 8. Pendientes de verificación en la nube (del anexo de la auditoría)

La auditoría fue estática; conviene un pentest dinámico que verifique en un entorno real:
efectividad de RLS ante un JWT manipulado, si una URL firmada de Supabase sirve `text/html`
inline, los flags reales de las cookies de sesión (`httpOnly`/`Secure`/`SameSite`), las
cabeceras que añada Vercel, y los límites de tasa del proyecto Supabase en la nube (`config.toml`
gobierna solo el entorno local). Detalle en
[docs/AUDITORIA.md → Anexo](AUDITORIA.md).
