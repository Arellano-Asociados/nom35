# @nom35/pruebas-rls

Suite de aislamiento multi-tenant. **Gate de CI innegociable** (regla inviolable 6 de CLAUDE.md).

Verifica contra un Postgres de Supabase real (no mocks), simulando usuarios como lo hace
PostgREST (`SET LOCAL ROLE` + claims JWT):

- RLS activo en todas las tablas públicas; toda tabla está clasificada (global o tenant).
- Un usuario del tenant A no lee/escribe filas del tenant B; claims manipulados sin membresía
  real no dan acceso.
- Consultores solo acceden a empresas asignadas.
- Nadie del lado patronal (ni el propio empleado) hace `SELECT` sobre `responses`.
- Resultados individuales: solo Responsable Designado y el propio empleado.
- Inmutabilidad por triggers (aplican incluso al dueño de la tabla).
- Trigger de categoría normativa (umbrales 15/16 y 50/51) y seeds normativos.

## Ejecutar

Requiere Docker. Desde la raíz del repo:

```bash
pnpm exec supabase db start
pnpm exec supabase db reset       # aplica migraciones + seeds desde cero
pnpm --filter @nom35/pruebas-rls test:rls
```

Variable opcional: `SUPABASE_DB_URL` (default `postgresql://postgres:postgres@127.0.0.1:54322/postgres`).

Nota: el script se llama `test:rls` (no `test`) para que `pnpm test` en la raíz siga funcionando
sin Docker; en CI corre como job dedicado.
