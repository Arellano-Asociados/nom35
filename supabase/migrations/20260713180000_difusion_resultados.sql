-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 4: difusión de resultados a los trabajadores (NOM-035 5.7 e) y 7.8).
--
-- dissemination_records: constancia de difusión por ciclo — instantánea agregada
-- (ya con supresión n<3 y enmascarado de fila completa, aplicados ANTES de
-- sellar) en lenguaje llano, sellada con sha256 y versionada. APPEND-ONLY:
-- publicar de nuevo = fila nueva con version+1; la evidencia nunca se edita.
--
-- dissemination_receipts: acuse "Enterado" del trabajador sobre una versión
-- publicada. Se inserta desde el flujo del empleado (service_role, sin sesión),
-- patrón policy_acknowledgments. APPEND-ONLY.
-- ─────────────────────────────────────────────────────────────────────────────

create table dissemination_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  cycle_id uuid not null,
  version integer not null check (version > 0),
  -- Instantánea agregada YA suprimida; jamás datos individuales (regla 3).
  summary jsonb not null,
  sha256 text not null,
  published_by uuid not null,
  published_at timestamptz not null default now(),
  unique (company_id, id),
  unique (cycle_id, version),
  foreign key (company_id, cycle_id) references compliance_cycles (company_id, id)
);

comment on table dissemination_records is
  'Constancias de difusión de resultados (5.7 e / 7.8). APPEND-ONLY: la evidencia de qué se difundió y cuándo no se modifica jamás.';

create trigger dissemination_records_inmutable
  before update or delete on dissemination_records
  for each row execute function app.rechazar_modificacion();
create trigger dissemination_records_sin_truncate
  before truncate on dissemination_records
  for each statement execute function app.rechazar_modificacion();

create table dissemination_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  dissemination_id uuid not null,
  employee_id uuid not null,
  acknowledged_at timestamptz not null default now(),
  unique (dissemination_id, employee_id),
  foreign key (company_id, dissemination_id) references dissemination_records (company_id, id),
  foreign key (company_id, employee_id) references employees (company_id, id)
);

create trigger dissemination_receipts_inmutable
  before update or delete on dissemination_receipts
  for each row execute function app.rechazar_modificacion();
create trigger dissemination_receipts_sin_truncate
  before truncate on dissemination_receipts
  for each statement execute function app.rechazar_modificacion();

alter table dissemination_records enable row level security;
alter table dissemination_receipts enable row level security;

-- Lectura para cualquier miembro (el contenido ya está suprimido: es lo que se
-- publica a los trabajadores); publicación solo para gestión.
create policy dissemination_records_select on dissemination_records for select
  using (app.gestiona_tenant(company_id) or app.es_miembro(company_id));
create policy dissemination_records_insert on dissemination_records for insert
  with check (app.gestiona_tenant(company_id) and published_by = auth.uid());

-- Acuses: lectura para gestión; el INSERT es exclusivo del flujo del empleado
-- (service_role) — sin política ni GRANT de INSERT para authenticated.
create policy dissemination_receipts_select on dissemination_receipts for select
  using (app.gestiona_tenant(company_id));

grant select, insert on dissemination_records to authenticated;
grant select on dissemination_receipts to authenticated;
grant all on dissemination_records to service_role;
grant all on dissemination_receipts to service_role;
