# apps/web — Convenciones

Estas convenciones aplican al trabajar dentro de `apps/web`. Las reglas de negocio
inviolables que las gobiernan están en el `CLAUDE.md` de la raíz (§3) y siguen vigentes aquí.

## Flujo del empleado

- El enlace del empleado es la CAPACIDAD: hash SHA-256 en BD; cada acción de servidor
  revalida token, vigencia y estado. Todo acceso a datos del flujo del empleado es del
  lado servidor con service_role; las respuestas crudas jamás viajan a un navegador.
- Corregir una respuesta antes de enviar = fila nueva en `responses` (append-only intacto);
  la vigente es la más reciente (`ultimaRespuestaPorItem`).

## Trampas verificadas (no re-descubrir)

- Componentes cliente NUNCA dentro de carpetas con corchetes (`[token]`): `next start` no los
  resuelve (bug del React Client Manifest). Viven en `src/components/`, acciones en
  `src/acciones/`.
- No poner `loading.tsx` en segmentos del panel con formularios que hacen `redirect` a su
  misma ruta: el Router Cache del cliente sirve el payload viejo tras la mutación
  (verificado; intentado y revertido en Fase 2.5).
- OJO en Windows: no reescribir archivos fuente con Get-Content/Set-Content de PowerShell 5.1
  (lee UTF-8 sin BOM como ANSI y corrompe acentos).

## Autorización y datos

- **El panel opera con `clienteSesion()` (RLS real, Fase 2.5)**: `service_role`
  (`supabase-admin`) solo en usos justificados con comentario (bootstrap de empresa,
  agregación/lectura auditada de resultados, tokens+correos, Storage, auth.admin) y
  está PROHIBIDO por lint en `app/panel/**` salvo los consumidores listados en
  `eslint.config.mjs`. `risk_results`/`gr1_results` no tienen GRANT para `authenticated`:
  el único camino al dato individual es la app auditada.
- Correos: jamás incluir datos sensibles; notificaciones genéricas + evento en audit_log
  (actor sistema = uuid cero).

## E2E (Playwright)

- `locator.count()` **no espera** — lee el DOM en el instante en que se llama. Tras un clic que
  dispara una transición cliente (nueva sección del cuestionario, montaje inicial tras
  "Comenzar cuestionario"), espera una señal explícita (texto, testid) de que el contenido
  nuevo ya montó antes de volver a contar o clicar; si no, cuentas la sección vieja y respondes
  de menos, dejando el cuestionario permanentemente incompleto. Ver `e2e/utilidades.ts`.
