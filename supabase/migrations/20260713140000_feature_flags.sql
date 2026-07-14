-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3: feature flags por organización (terreno para planes comerciales).
--
-- Lectura: cualquier miembro del tenant (el flag decide qué UI/capacidades ve).
-- Escritura: SOLO la plataforma (service_role) — un admin_org no puede
-- autoconcederse un plan; no hay GRANT de INSERT/UPDATE/DELETE para authenticated.
-- La evaluación es SIEMPRE en servidor (lib/flags.ts); sin fila aplica el default
-- sensato del código.
-- ─────────────────────────────────────────────────────────────────────────────

create table feature_flags (
  company_id uuid not null references companies (id) on delete cascade,
  flag text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (company_id, flag)
);

alter table feature_flags enable row level security;

create policy feature_flags_select on feature_flags for select
  using (app.es_mi_tenant(company_id));

grant select on feature_flags to authenticated;
grant all on feature_flags to service_role;
