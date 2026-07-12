# Guion de demo (10 minutos)

Guion para presentar el ciclo completo de la plataforma sobre datos de
"Empresa Demo NOM-035, S.A. de C.V." sembrados por `scripts/demo-seed.mjs`. Todos los
resultados que se muestran fueron calculados por el motor real
(`@nom35/motor-nom035`, `calificarCuestionario`/`evaluarGR1`) sobre vectores de respuesta
realistas, no inventados a mano.

## Prerrequisitos

1. Docker Desktop corriendo.
2. Desde la raíz del repo:
   ```bash
   pnpm install
   pnpm exec supabase start      # imprime las llaves locales
   pnpm exec supabase db reset   # aplica migraciones + seeds normativos desde cero
   ```
3. Copia `.env.example` a `apps/web/.env.local` y llena `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` con lo que imprimió
   `supabase start` (`NEXT_PUBLIC_SUPABASE_URL` normalmente ya es `http://127.0.0.1:54321`).
   El seed lee las mismas dos variables (`NEXT_PUBLIC_SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY`) directamente del entorno del shell donde lo corras — expórtalas
   ahí también si no usas un cargador de `.env`:
   - bash: `export $(cat apps/web/.env.local | xargs)` (o equivalente).
   - PowerShell 5.1 (Windows): sin `xargs` ni `export`; carga cada línea `CLAVE=valor` de
     `.env.local` como variable de entorno del proceso actual con
     ```powershell
     Get-Content apps/web/.env.local | ForEach-Object {
       if ($_ -match '^\s*([^#=]+)=(.*)$') {
         [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), 'Process')
       }
     }
     ```
     (dura solo esa sesión de PowerShell; repítelo si abres una terminal nueva).
4. Siembra los datos de demo:
   ```bash
   pnpm demo:seed
   ```
   Este comando primero compila `@nom35/motor-nom035` a CommonJS en
   `packages/motor-nom035/dist/` (ver "Cómo funciona" abajo) y luego corre el seed. Al terminar
   imprime en consola las credenciales y los IDs de empresa/ciclo.
5. En otra terminal, levanta la app:
   ```bash
   pnpm --filter @nom35/web dev
   ```
   y abre `http://localhost:3000/ingresar`.

## Credenciales de demo

| Rol                   | Correo                 | Contraseña        |
| --------------------- | ---------------------- | ----------------- |
| Admin de Organización | `admin@demo.nom035.mx` | `DemoNom035!2026` |
| Responsable Designado | `rd@demo.nom035.mx`    | `DemoNom035!2026` |

Ambas cuentas ya están dadas de alta en Supabase Auth (`email_confirm: true`) y con su
membresía en `role_assignments` — no hace falta registrarse, solo "Ingresar".

## Datos que vas a encontrar

- **Empresa Demo NOM-035, S.A. de C.V.**, RFC ficticio, con dos centros de trabajo:
  - **Centro Corporativo CDMX** — headcount 65 → categoría `gr1_gr3` (GR-I + GR-III), 18
    empleados.
  - **Centro Sucursal Guadalajara** — headcount 30 → categoría `gr1_gr2` (GR-I + GR-II), 12
    empleados.
- Empleados repartidos en las áreas Ventas / Producción / Administración / Logística, con
  variación en "atiende clientes" / "supervisa personal" (para ejercitar los ítems
  condicionales de la GR-II/GR-III).
- Un ciclo "Ciclo 2026" por centro, ya distribuido: cada empleado tiene su asignación GR-I +
  la guía Likert de su centro.
- Resultados Likert repartidos deliberadamente para que el dashboard agregado muestre
  distribución real, no un único nivel: el Centro Corporativo CDMX rota los 5 niveles
  (nulo/bajo/medio/alto/muy alto); el Centro Sucursal Guadalajara rota solo 3 (nulo/medio/
  alto) a propósito — con sus 11 completados repartidos en 5 niveles, las celdas de n=2
  dispararían la supresión complementaria por descomposición forzada (regla inviolable 3,
  `lib/agregados.ts`) y ocultarían la tabla global de Cfinal por completo; con 3 niveles
  (4/4/3) ninguna celda queda por debajo de 3 y la tabla global se ve completa (los filtros
  por área siguen mostrando supresión real, con celdas más pequeñas).
- GR-I: la mayoría "sin acontecimiento traumático"; **en cada uno de los dos centros** hay un
  caso con acontecimiento que **dispara canalización** (ya marcado como `canalizado` en la
  vista de canalizaciones: 2 en total) y otro caso con acontecimiento que **no** alcanza el
  umbral de valoración clínica (variedad realista, también uno por centro).
- Una política de prevención publicada (archivo real en el bucket `politicas`, así que el
  botón de descarga y el expediente funcionan) con acuse de ~la mitad de los empleados.
- Dos contenidos de capacitación con registros de ~la mitad de los empleados.
- 4 acciones de la Tabla 7 (Cap. 8) en distintos niveles de origen.
- Un empleado por centro se dejó **sin completar** a propósito (assignment creado, sin
  respuestas): al final de `pnpm demo:seed` se imprime su enlace `/responder/<token>` por si
  quieres mostrar en vivo el flujo del empleado (consentimiento → filtros → cuestionario →
  resultado propio) además del recorrido administrativo de abajo.

## Recorrido sugerido (≈10 min)

1. **Ingresar** (`/ingresar`) con `admin@demo.nom035.mx`. Verás "Mis empresas" con la empresa
   demo.
2. **Empresa → Centros**: entra a la empresa; en la pestaña **Centros** muestra los dos
   centros y su categoría normativa derivada automáticamente del headcount (badge
   "GR-I + GR-III (>50)" / "GR-I + GR-II (16–50)").
3. **Empleados**: pestaña **Empleados**, filtra por centro; señala las columnas de área y los
   flags de atiende-clientes/supervisa-personal.
4. **Ciclo**: pestaña **Ciclos** → abre "Ciclo 2026" de un centro. Muestra:
   - el resumen del evaluador (nombre + cédula, requisito normativo),
   - "Progreso por área" (completados/pendientes — aquí se nota el empleado que quedó
     pendiente),
   - los botones "Distribuir cuestionarios" / "Enviar recordatorios a pendientes" (puedes
     pulsar "recordatorios" para mostrar que rota el token del pendiente sin duplicar nada).
5. **Dashboard agregado** (subpestaña del ciclo): distribución de niveles por Cfinal,
   categoría y dominio. Filtra por área y señala que **nunca hay promedios**, solo conteos —
   y que cualquier celda con menos de 3 personas se **suprime** (anti-reidentificación,
   regla inviolable 3): la tabla global de Cfinal se ve completa en ambos centros, pero en
   cuanto filtras por área vas a encontrar alguna celda pequeña suprimida (con 17/11
   completados repartidos entre 4 áreas, cualquier área cae fácilmente por debajo de 3 en
   algún nivel).
6. **Acciones (Cap. 8)**: las 4 acciones de la Tabla 7 ya cargadas, con su nivel de origen.
7. **Canalizaciones GR-I**: aquí necesitas estar **ingresado como el Responsable Designado**
   (cierra sesión, entra con `rd@demo.nom035.mx`) — el Admin de Organización ve el aviso de
   "exclusiva del Responsable Designado". Como RD sí puedes ver la fila ya marcada
   `canalizado` y la que sigue `pendiente`, y cambiar su estatus con el selector.
8. **Resultados individuales procesados**: subpestaña "Resultados individuales" (mismo login
   de RD). Elige un trabajador: aparece primero el **interstitial** de advertencia ("es un
   dato personal sensible... esta consulta quedará registrada..."); al confirmar
   ("Entiendo, consultar resultado") se muestra el resultado y, **en cada recarga**, se
   inserta un evento `individual_result_access` nuevo en `audit_log` — recarga la página para
   mostrar que efectivamente vuelve a auditar.
9. **Informes y expediente**: vuelve a entrar como Admin de Organización, ve a "Informes y
   expediente" del ciclo. Genera el **Informe 7.9** y luego el **Expediente de inspección**
   (ZIP): descárgalo y ábrelo para mostrar `informe-7-9.pdf`, `politica-prevencion.txt` (el
   archivo real subido por el seed — no un `storage_path` colgado), los CSV de evidencia de
   proceso (acuses, participación, capacitación, acciones, resumen de auditoría) y
   `manifiesto.json` con el sha256 de cada archivo.
10. **Cierre**: recalca que todo lo mostrado —dashboard, informe, expediente— sale de
    `risk_results`/`gr1_results`/`responses`, tablas append-only que nunca se editan ni se
    borran (regla de inmutabilidad), y que ningún rol patronal tuvo acceso a una respuesta
    cruda en ningún momento del recorrido.

## Cómo re-sembrar

El seed es **idempotente por clave natural** (razón social, email de empleado, título de
política/capacitación, etc.), no por conteo de filas: correrlo de nuevo sobre la misma base no
duplica nada, solo completa lo que falte. Para partir de cero:

```bash
pnpm exec supabase db reset   # borra y re-aplica migraciones + seeds normativos
pnpm demo:seed
```

Si vuelves a correr `pnpm demo:seed` **sin** resetear la base, es seguro: las cuentas, la
empresa, los centros, empleados, ciclo y política se reutilizan; los empleados que ya tenían
respuestas/resultados no se tocan (evidencia append-only intacta).

## Cómo funciona (para quien toque el script)

- `@nom35/motor-nom035` se consume normalmente como **fuente TypeScript**
  (`"type": "module"`, `"main": "src/index.ts"`, sin `dist/` versionado) — así es como lo
  importan Next.js y el resto del monorepo. `scripts/demo-seed.mjs` es Node puro sin loader de
  TypeScript instalado (no hay `tsx` en el repo), así que no puede importar `.ts` directamente.
- Para resolver esto **sin tocar cómo la app consume el paquete**, se agregó un build
  alterno: `packages/motor-nom035/tsconfig.build.json` (emite CommonJS a `dist/`, con
  `verbatimModuleSyntax` desactivado solo ahí) + el script `build` en
  `packages/motor-nom035/package.json`. El `"main"` del paquete **no se tocó** — sigue
  apuntando a `src/index.ts` para todo lo demás (Next.js, vitest, typecheck).
  `scripts/demo-seed.mjs` importa el motor por **ruta relativa** directa a
  `../packages/motor-nom035/dist/index.js`, no por el nombre del paquete, así que esta
  decisión no afecta en nada la resolución de módulos de `apps/web`.
- `pnpm demo:seed` encadena `pnpm --filter @nom35/motor-nom035 run build && node
scripts/demo-seed.mjs`, así que el build corre automáticamente en cada invocación (no hay
  paso manual que se te pueda olvidar).
- El seed usa `@supabase/supabase-js` con la llave `service_role` (bypassa RLS, igual que
  el backend real) para insertar/leer directamente; usa `auth.admin.createUser` para las dos
  cuentas de demo y `storage.from(...).upload(...)` para la política y la capacitación.
- Cada nivel de riesgo (nulo…muy alto) se logra armando un vector de respuestas Likert cuya
  suma total cae dentro del rango de `risk_level_ranges` de esa guía (ver
  `packages/motor-nom035/src/datos/gr2.ts` y `gr3.ts`) y corriéndolo por
  `calificarCuestionario` — el motor decide el nivel, el script nunca lo asigna a mano.

## Limitaciones conocidas

- **Correo no configurado en local**: sin `RESEND_API_KEY`, `proveedorCorreo()`
  (`apps/web/src/lib/correo.ts`) usa un proveedor nulo que no envía nada (silencioso a
  propósito). El botón "Enviar recordatorios a pendientes" y la notificación de canalización
  al RD funcionan (generan el token nuevo / el evento de auditoría) pero ningún correo real
  sale; no hay nada que mostrar en una bandeja de entrada durante la demo.
- **Sin verificación de runtime**: este seed se escribió y revisó sin Docker/Supabase local
  disponibles en el entorno de desarrollo. Se validó con `node --check`, ESLint, Prettier,
  `tsc --noEmit` (typecheck del repo, sin relación directa con este script) y trazando cada
  INSERT contra el esquema real (`supabase/migrations/20260711200002_tablas_tenant.sql`) y
  contra `packages/pruebas-rls/src/fixtures.sql` como referencia de forma de fila. La primera
  corrida real contra Supabase local **no se ejecutó**; síguela con atención la primera vez
  (ver `.superpowers/sdd/task-6-report.md` para el checklist paso a paso).
- **Reintentos tras una corrida interrumpida a la mitad de un empleado**: la idempotencia de
  respuestas/resultados se decide por "¿ya hay filas en `responses` para esta asignación?". Si
  el script se cae justo entre insertar `responses` e insertar `risk_results`/`gr1_results`
  para un empleado, una re-corrida no completará ese resultado faltante (verías respuestas sin
  resultado). Es un caso extremo (solo ocurre si el proceso se interrumpe a la mitad); si pasa,
  lo más simple es `supabase db reset && pnpm demo:seed` de nuevo.
- **RFC ficticio** (`DNO260711AB3`) y contenido de política/capacitación son textos de
  demostración (`.txt`, no `.pdf`) — no usar como plantilla real ante la STPS.
