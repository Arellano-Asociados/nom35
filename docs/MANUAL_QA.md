# Manual de QA — Constata (verificación manual sobre el seed de demo)

Este manual verifica el producto de punta a punta usando el **seed de demo comercial**
(`pnpm seed:demo`). Cada prueba dice qué se prueba, los pasos exactos con los datos del
seed, el resultado esperado y una casilla. La columna **Modo** indica si la prueba es
**Auto** (verificable por `node scripts/qa-verificacion.mjs`, ver §17) o **Humana**
(requiere ojos en la UI, con instrucciones exactas).

## Preparación (una vez)

```bash
pnpm exec supabase start          # Supabase local arriba
pnpm exec supabase db reset       # migraciones + seeds normativos desde cero
pnpm seed:demo                    # dataset "Constata Demo" (idempotente)
pnpm --filter web build && pnpm --filter web exec next start --port 3000   # o `pnpm --filter web dev`
```

Abre `http://localhost:3000`.

### Cuentas del seed

| Rol                           | Correo                      | Contraseña          |
| ----------------------------- | --------------------------- | ------------------- |
| Admin de Organización (Org 1) | `admin@constata-demo.mx`    | `ConstataDemo!2026` |
| Responsable Designado (Org 1) | `rd@constata-demo.mx`       | `ConstataDemo!2026` |
| Admin de Organización (Org 2) | `admin@aislamiento-demo.mx` | `ConstataDemo!2026` |

- **Org 1 — Constata Demo, S.A. de C.V.**: 3 centros (Corporativo CDMX >50 GR-III;
  Sucursal Monterrey 16–50 GR-II; Taller Querétaro ≤15 solo GR-I), 62 empleados.
- **Org 2 — Aislamiento Demo, S. de R.L.**: 1 centro, 8 empleados (para negativos de
  aislamiento).
- Ciclo **completado** con los 5 niveles del semáforo: "Ciclo 2026 — Corporativo".
- Ciclo **en curso ~40%**: "Ciclo 2026 — Monterrey".

Para el **portal de plataforma** (`/admin`) y algunos negativos hace falta un operador:

```bash
pnpm operador:crear operador@constata.mx "OperadorDemo!2026"
```

---

## 1. Acceso y autenticación

| #   | Prueba                | Pasos                                                                    | Resultado esperado                                        | Modo   | ☐   |
| --- | --------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- | ------ | --- |
| 1.1 | Login del admin       | En `/ingresar`, entra con `admin@constata-demo.mx` / `ConstataDemo!2026` | Aterriza en el panel; ve "Mis empresas" con Constata Demo | Humana | ☐   |
| 1.2 | Contraseña incorrecta | Login con contraseña `mala`                                              | Mensaje "Correo o contraseña incorrectos"; no entra       | Humana | ☐   |
| 1.3 | Cerrar sesión         | Botón "Salir" del panel                                                  | Vuelve a `/ingresar`; recargar `/panel` redirige a login  | Humana | ☐   |

## 2. Dashboard ejecutivo (inicio del panel)

| #   | Prueba                            | Pasos                                                          | Resultado esperado                                                                                                                      | Modo   | ☐   |
| --- | --------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ | --- |
| 2.1 | El inicio muestra el tablero      | Login Org 1 → entra a Constata Demo                            | Ve "Estado de Ciclo 2026 — …" con tiles (participación, sin responder, canalizaciones GR-I, bienal) — NO el checklist de primeros pasos | Humana | ☐   |
| 2.2 | Semáforo global con los 5 niveles | En el dashboard, tabla "Semáforo global" del ciclo Corporativo | Muestra conteos en nulo/bajo/medio/alto/muy_alto (6 cada uno), ninguna celda suprimida                                                  | Auto   | ☐   |
| 2.3 | Semáforo por centro con supresión | Tabla "Semáforo por centro"                                    | Centros con <3 respuestas por celda aparecen enmascarados ("—"): grupo pequeño, no reportable                                           | Humana | ☐   |
| 2.4 | Pendientes normativos             | Sección "Pendientes normativos"                                | Señala canalizaciones GR-I abiertas y (si aplica) programa/política; los resueltos con ✓                                                | Humana | ☐   |
| 2.5 | Vencimientos                      | Sección "Próximos vencimientos"                                | Lista acciones del programa con fecha compromiso y/o reevaluación bienal                                                                | Humana | ☐   |

## 3. Centros y empleados

| #   | Prueba                         | Pasos                                           | Resultado esperado                                                                                          | Modo   | ☐   |
| --- | ------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------ | --- |
| 3.1 | Categoría normativa por tamaño | Sidebar → Centros                               | Corporativo CDMX = "GR-I + GR-III (>50)"; Monterrey = "GR-I + GR-II (16–50)"; Querétaro = "Solo GR-I (≤15)" | Auto   | ☐   |
| 3.2 | Padrón de empleados            | Sidebar → Empleados                             | ~62 empleados con nombres mexicanos, área y centro                                                          | Auto   | ☐   |
| 3.3 | Alta de empleado               | Empleados → alta individual con un correo nuevo | Aparece en la lista; correo duplicado se rechaza                                                            | Humana | ☐   |

## 4. Ciclos y distribución

| #   | Prueba                           | Pasos                   | Resultado esperado                                             | Modo | ☐   |
| --- | -------------------------------- | ----------------------- | -------------------------------------------------------------- | ---- | --- |
| 4.1 | Ciclo completado vs en curso     | Ciclos                  | "Corporativo" cerrado con resultados; "Monterrey" abierto ~40% | Auto | ☐   |
| 4.2 | Participación del ciclo en curso | Abre el ciclo Monterrey | Participación ~40% (8 de 20 GR-II)                             | Auto | ☐   |

## 5. Flujo del empleado (responder)

| #   | Prueba                    | Pasos                                                                                                                                                             | Resultado esperado                                                | Modo   | ☐   |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------ | --- |
| 5.1 | Responder un cuestionario | El seed deja asignaciones sin completar en Monterrey. Genera un enlace nuevo desde "Distribuir/recordatorios" o usa un token pendiente; abre `/responder/<token>` | Consentimiento → filtros → cuestionario por secciones → "enviado" | Humana | ☐   |
| 5.2 | Guardado incremental      | A media respuesta, recarga la página del cuestionario                                                                                                             | Las respuestas dadas se conservan                                 | Humana | ☐   |
| 5.3 | Enlace inválido           | Abre `/responder/token-inexistente`                                                                                                                               | "Enlace inválido" (nunca datos)                                   | Humana | ☐   |

## 6. Dashboard agregado del ciclo

| #   | Prueba                        | Pasos                         | Resultado esperado                                                              | Modo   | ☐   |
| --- | ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------- | ------ | --- |
| 6.1 | Distribuciones sin promedios  | Ciclo Corporativo → Dashboard | Conteos y % por nivel (Cfinal, categoría, dominio); NUNCA un "promedio"         | Humana | ☐   |
| 6.2 | Supresión n<3 y fila completa | Filtra por un área pequeña    | Si una celda cae en <3, la FILA COMPLETA se enmascara (incluidos ceros y total) | Humana | ☐   |

## 7. Resultados individuales (Responsable Designado)

| #   | Prueba                   | Pasos                                                                         | Resultado esperado                                                          | Modo   | ☐   |
| --- | ------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------ | --- |
| 7.1 | Solo el RD ve resultados | Login como `rd@constata-demo.mx`; abre un resultado individual (interstitial) | El RD ve el resultado; el admin sin flag RD no tiene esa opción             | Humana | ☐   |
| 7.2 | Cada consulta se audita  | Tras 7.1, consulta `audit_log` por `individual_result_access` del RD          | Hay una fila nueva por cada consulta                                        | Humana | ☐   |
| 7.3 | Canalización GR-I        | RD → vista GR-I del ciclo                                                     | Ve casos que requieren valoración; puede cambiar el estatus de canalización | Humana | ☐   |

## 8. Programa de intervención

| #   | Prueba                    | Pasos                           | Resultado esperado                                                              | Modo   | ☐   |
| --- | ------------------------- | ------------------------------- | ------------------------------------------------------------------------------- | ------ | --- |
| 8.1 | Programa exigido y creado | Ciclo Corporativo → Acciones    | Ve el programa con 4 acciones en estados: completada, en progreso, 2 pendientes | Auto   | ☐   |
| 8.2 | Registrar avance          | Cambia el estatus de una acción | Se refleja en la lista y en el conteo de avance                                 | Humana | ☐   |

## 9. Buzón de quejas

| #   | Prueba                          | Pasos                                                                             | Resultado esperado                                       | Modo   | ☐   |
| --- | ------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------- | ------ | --- |
| 9.1 | Dos quejas en estados distintos | Sidebar → Buzón                                                                   | `QJ-DEMO-0001` en revisión, `QJ-DEMO-0002` cerrada       | Auto   | ☐   |
| 9.2 | Lectura auditada del contenido  | Abre una queja (lectura del contenido)                                            | Se registra `queja_consultada` en `audit_log`            | Humana | ☐   |
| 9.3 | Presentar una queja             | Copia el enlace del buzón (Buzón → enlace) y ábrelo en incógnito; envía una queja | Devuelve folio + clave; el contenido no viaja en correos | Humana | ☐   |

## 10. Acontecimientos traumáticos (ATS)

| #    | Prueba                | Pasos                         | Resultado esperado                                                                    | Modo | ☐   |
| ---- | --------------------- | ----------------------------- | ------------------------------------------------------------------------------------- | ---- | --- |
| 10.1 | Evento registrado     | Sidebar → Eventos traumáticos | "Asalto a mano armada…" en Sucursal Monterrey                                         | Auto | ☐   |
| 10.2 | GR-I solo a expuestos | Abre el evento                | 2 trabajadores evaluados, uno canalizado; el resto del centro no fue evaluado por ATS | Auto | ☐   |

## 11. Difusión de resultados

| #    | Prueba               | Pasos                        | Resultado esperado                                          | Modo | ☐   |
| ---- | -------------------- | ---------------------------- | ----------------------------------------------------------- | ---- | --- |
| 11.1 | Constancia publicada | Ciclo Corporativo → Difusión | Existe una constancia sellada (sha256) con resumen agregado | Auto | ☐   |

## 12. Cuestionarios personalizados

| #    | Prueba                  | Pasos                                     | Resultado esperado                                     | Modo   | ☐   |
| ---- | ----------------------- | ----------------------------------------- | ------------------------------------------------------ | ------ | --- |
| 12.1 | Cuestionario publicado  | Sidebar → Cuestionarios                   | "Encuesta interna de clima (demo)" en estado publicado | Auto   | ☐   |
| 12.2 | Inmutable tras publicar | Intenta editar el contenido del publicado | La UI no permite editar el contenido (solo archivar)   | Humana | ☐   |

## 13. Informes y expediente

| #    | Prueba              | Pasos                                  | Resultado esperado                                                     | Modo   | ☐   |
| ---- | ------------------- | -------------------------------------- | ---------------------------------------------------------------------- | ------ | --- |
| 13.1 | Generar informe 7.7 | Ciclo Corporativo → Informes → Generar | PDF con distribuciones (con supresión), sin resultados individuales    | Humana | ☐   |
| 13.2 | Expediente ZIP      | Genera el expediente                   | ZIP con INDICE, instrumentos sellados, CSVs de proceso, huellas sha256 | Humana | ☐   |
| 13.3 | Descarga            | Descarga un informe generado           | Signed URL abre el archivo; la huella coincide                         | Humana | ☐   |

## 14. Asistencia por IA

> El flag `ia_asistida` está ACTIVO en Org 1. En local sin `ANTHROPIC_API_KEY`, arranca el
> servidor con `IA_SIMULADA=1` para poder generar (texto determinista, sin red):
> `IA_SIMULADA=1 pnpm --filter web exec next start --port 3000`.

| #    | Prueba                          | Pasos                                                                                         | Resultado esperado                                                                     | Modo   | ☐   |
| ---- | ------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ | --- |
| 14.1 | Borrador de resumen ya sembrado | Dashboard de Org 1 → franja "Resumen ejecutivo"                                               | Muestra un resumen ADOPTADO con la leyenda "revisado y adoptado por … el …"            | Auto   | ☐   |
| 14.2 | Generar y adoptar               | Genera un borrador nuevo → aparece marca "BORRADOR — sin revisar" → "Revisé y adopto"         | El borrador es visualmente inconfundible; tras adoptar, leyenda con tu usuario y fecha | Humana | ☐   |
| 14.3 | Plan de acción IA               | Ciclo Corporativo → Acciones → "Generar borrador de plan" → editar → "Adoptar en el programa" | Las medidas se agregan al programa marcadas como "asistidas por IA" (`ai_assisted`)    | Humana | ☐   |
| 14.4 | Eventos en bitácora             | Tras generar/adoptar, consulta `audit_log`                                                    | Hay `ia_borrador_generado` y `ia_borrador_adoptado` (sin el texto en `details`)        | Humana | ☐   |

## 15. Portal de plataforma (`/admin`)

> Requiere el operador de la Preparación y activar TOTP en el primer acceso.

| #    | Prueba                       | Pasos                                     | Resultado esperado                                                                        | Modo   | ☐   |
| ---- | ---------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- | ------ | --- |
| 15.1 | MFA forzado                  | Entra a `/admin/ingresar` con el operador | Exige enrolar TOTP antes de llegar al portal                                              | Humana | ☐   |
| 15.2 | Métricas operativas          | Portal → Inicio                           | Organizaciones por estado, empleados, tasa de respuesta agregada — nada derivado de salud | Humana | ☐   |
| 15.3 | Directorio de organizaciones | Portal → Organizaciones                   | Ve Constata Demo y Aislamiento Demo (ambas activas)                                       | Auto   | ☐   |
| 15.4 | Feature flags desde UI       | Ficha de Constata Demo → togglear un flag | Cambia con doble bitácora (plataforma + tenant)                                           | Humana | ☐   |
| 15.5 | Bitácora de plataforma       | Portal → Bitácora                         | Filtrable por operador/empresa/evento, paginada                                           | Humana | ☐   |

## 16. NEGATIVOS (deben FALLAR / bloquear)

| #    | Prueba                                          | Pasos                                                                                                                                                                                | Resultado esperado                                                                                                                                  | Modo   | ☐   |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --- |
| 16.1 | **Aislamiento entre organizaciones**            | Login como `admin@constata-demo.mx`; en "Mis empresas" NO aparece Aislamiento Demo                                                                                                   | El admin de Org 1 no ve Org 2 en ninguna lista                                                                                                      | Auto   | ☐   |
| 16.2 | **URL de otra empresa**                         | Logueado como admin de Org 1, navega a `/panel/<ID_de_Org_2>` (toma el id de Aislamiento Demo)                                                                                       | Redirige a `/panel` (no es miembro): no ve ni un dato de Org 2                                                                                      | Humana | ☐   |
| 16.3 | **Archivo no-PDF**                              | Política → subir un `.txt` o `.exe` renombrado a `.pdf`                                                                                                                              | Rechazado por validación de magic bytes; no se sube                                                                                                 | Humana | ☐   |
| 16.4 | **Tenant suspendido intenta escribir**          | Suspende Constata Demo desde `/admin` (o SQL: `update companies set status='suspended' where legal_name='Constata Demo, S.A. de C.V.'`), luego como su admin intenta crear un centro | La escritura falla (RLS 42501 / mensaje de solo lectura); la lectura y descarga siguen. Reactivar al terminar. (También cubierto por la suite RLS.) | Humana | ☐   |
| 16.5 | **Grant de soporte expirado**                   | Crea un grant vencido (SQL, ver abajo) e intenta entrar a `/admin/soporte/<companyId>` como el operador                                                                              | `autorizarSoporte` rechaza (grant no vigente): rebota a la ficha, sin evento de vista. (El núcleo `evaluarGrantSoporte` tiene unit test.)           | Humana | ☐   |
| 16.6 | **Respuestas crudas: nadie patronal**           | Como admin, intenta leer `responses` por API/REST con el anon key                                                                                                                    | Sin GRANT: rechazo duro (401/403), jamás una respuesta ítem por ítem                                                                                | Auto   | ☐   |
| 16.7 | **Borrador de IA no adoptado no es exportable** | Genera un borrador (no lo adoptes); en la franja/plan, busca cualquier botón de descargar/copiar/exportar                                                                            | No existe ninguno; el borrador lleva la marca "sin revisar" y no aparece en informes ni PDFs                                                        | Humana | ☐   |

### SQL de preparación de negativos

```sql
-- 16.5: grant de soporte YA vencido para el operador (ajusta los ids con los del seed/operador)
insert into support_access_grants
  (company_id, operator_user_id, operator_email, granted_by_user_id, reason, created_at, expires_at)
select c.id, p.id, p.email, r.auth_user_id, 'QA grant vencido',
       now() - interval '3 days', now() - interval '2 days'
from companies c, platform_users p, role_assignments r
where c.legal_name = 'Constata Demo, S.A. de C.V.'
  and p.email = 'operador@constata.mx'
  and r.company_id = c.id and r.role = 'admin_org'
limit 1;
```

## 17. Verificación automatizable

Los renglones marcados **Auto** se comprueban con `scripts/qa-verificacion.mjs` (lee la BD
sembrada y afirma cada resultado esperado). Los marcados **Humana** requieren un par de ojos
en la UI siguiendo los pasos exactos de arriba: no hay atajo, son de experiencia visual
(marcas de borrador, mensajes, PDFs, redirecciones del navegador).

```bash
node scripts/qa-verificacion.mjs   # corre las verificaciones Auto contra el seed
```
