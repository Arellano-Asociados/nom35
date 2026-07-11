-- Esquema global (no-tenant): catálogos normativos, usuarios de plataforma y configuración.
-- Las matrices, grupos y rangos de la NOM-035 viven en TABLAS DE DATOS (regla inviolable 7):
-- scoring_rules, item_structure, risk_level_ranges. El motor y la app solo las consumen.

create extension if not exists citext;

-- Esquema para funciones auxiliares (helpers de RLS, triggers)
create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Catálogos normativos
-- ─────────────────────────────────────────────────────────────────────────────

create table questionnaires (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('GR-I', 'GR-II', 'GR-III')),
  name text not null,
  total_items integer not null check (total_items > 0),
  source text not null default 'DOF 23-10-2018',
  created_at timestamptz not null default now()
);

comment on table questionnaires is 'Guías de Referencia de la NOM-035-STPS-2018';

create table questions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references questionnaires (id),
  -- GR-I se numera por sección (I–IV); GR-II/GR-III no tienen sección
  section text check (section in ('I', 'II', 'III', 'IV')),
  item_number integer not null check (item_number > 0),
  text text not null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (questionnaire_id, section, item_number)
);

comment on column questions.text is
  'Texto oficial del ítem. Placeholder ITEM_TEXT_PENDIENTE_i hasta cargar el seed con el texto del DOF.';

create table scoring_rules (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references questionnaires (id),
  scoring_group char(1) not null check (scoring_group in ('A', 'B')),
  option_value text not null check (
    option_value in ('siempre', 'casi_siempre', 'algunas_veces', 'casi_nunca', 'nunca')
  ),
  score integer not null check (score between 0 and 4),
  unique (questionnaire_id, scoring_group, option_value)
);

comment on table scoring_rules is
  'Valor de cada opción por grupo: A directo (Siempre=0…Nunca=4), B inverso (Siempre=4…Nunca=0)';

create table item_structure (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references questionnaires (id),
  item_number integer not null check (item_number > 0),
  scoring_group char(1) check (scoring_group in ('A', 'B')),
  domain text,
  -- En la GR-II los ítems 18 y 19 pertenecen al dominio "Falta de control sobre el trabajo"
  -- pero NO puntúan en ninguna categoría (así lo define el DOF): category queda NULL.
  category text,
  conditional text check (conditional in ('atiende_clientes', 'supervisa_personal')),
  unique (questionnaire_id, item_number)
);

create table risk_level_ranges (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references questionnaires (id),
  scope text not null check (scope in ('cfinal', 'categoria', 'dominio')),
  scope_name text,
  nulo_max numeric not null,
  bajo_max numeric not null,
  medio_max numeric not null,
  alto_max numeric not null,
  check (nulo_max < bajo_max and bajo_max < medio_max and medio_max < alto_max),
  check ((scope = 'cfinal') = (scope_name is null)),
  unique nulls not distinct (questionnaire_id, scope, scope_name)
);

comment on table risk_level_ranges is
  'Regla compartida: puntaje < nulo_max → nulo; < bajo_max → bajo; < medio_max → medio; < alto_max → alto; ≥ alto_max → muy alto';

-- ─────────────────────────────────────────────────────────────────────────────
-- Plataforma
-- ─────────────────────────────────────────────────────────────────────────────

create table platform_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email citext not null unique,
  created_at timestamptz not null default now()
);

comment on table platform_users is
  'Administradores de la plataforma. NO tienen acceso de lectura a datos de tenants vía RLS (minimización de acceso); las operaciones de soporte pasan por el backend con service_role y quedan auditadas.';

create table system_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS de tablas globales
-- ─────────────────────────────────────────────────────────────────────────────
-- Catálogos normativos: lectura pública (no contienen datos personales); escritura solo
-- service_role (sin políticas de escritura).

alter table questionnaires enable row level security;
alter table questions enable row level security;
alter table scoring_rules enable row level security;
alter table item_structure enable row level security;
alter table risk_level_ranges enable row level security;
alter table platform_users enable row level security;
alter table system_config enable row level security;

create policy catalogo_lectura on questionnaires for select using (true);
create policy catalogo_lectura on questions for select using (true);
create policy catalogo_lectura on scoring_rules for select using (true);
create policy catalogo_lectura on item_structure for select using (true);
create policy catalogo_lectura on risk_level_ranges for select using (true);

create policy propia_fila on platform_users for select
  using (auth_user_id = auth.uid());

create policy lectura_autenticados on system_config for select
  using (auth.role() = 'authenticated');

-- Grants (capa gruesa; RLS es la capa fina). El backend usa service_role, que además
-- tiene BYPASSRLS. Mínimo privilegio: los catálogos solo se leen.
grant select on questionnaires, questions, scoring_rules, item_structure, risk_level_ranges
  to anon, authenticated;
grant select on platform_users, system_config to authenticated;
grant all on questionnaires, questions, scoring_rules, item_structure, risk_level_ranges,
  platform_users, system_config to service_role;
