-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 4: buzón de quejas y denuncias (NOM-035 8.1 b, 5.7 d, 8.2 g).
--
-- complaint_boxes: enlace del buzón POR EMPRESA (la obligación es continua, no
--   por ciclo). El token se guarda también en claro: a diferencia de los tokens
--   de asignación, este enlace es DE DIFUSIÓN OBLIGATORIA (5.7 d) — no una
--   capacidad secreta personal; su secreto no protege datos (solo evita spam,
--   que cubre el limitador) y el panel necesita re-mostrarlo para difundirlo.
--   Un token por empresa (y no por empleado) hace el anonimato TÉCNICAMENTE
--   cierto: con token personal el servidor sabría quién envía.
--
-- complaints: el CONTENIDO de una queja tiene el estándar de los resultados
--   individuales (reglas 4/5): SIN GRANT para authenticated — el único camino es
--   la app con auditoría fail-closed. Solo `status` es mutable (trigger); el
--   texto del trabajador jamás se edita ni se borra.
--
-- complaint_events: bitácora de seguimiento por estados (8.2 g). Append-only.
-- ─────────────────────────────────────────────────────────────────────────────

create table complaint_boxes (
  company_id uuid primary key references companies (id) on delete cascade,
  token text not null,
  token_hash text not null unique,
  rotated_at timestamptz not null default now()
);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  folio text not null unique,
  -- Solo el hash de la clave de consulta toca la BD (patrón token_hash).
  folio_key_hash text not null,
  category text not null check (category in ('violencia_laboral', 'practicas_opuestas_eof')),
  body text not null,
  is_identified boolean not null default false,
  contact_name text,
  contact_info text,
  status text not null default 'recibida'
    check (status in ('recibida', 'en_revision', 'atendida', 'cerrada')),
  created_at timestamptz not null default now(),
  unique (company_id, id)
);

create index complaints_por_estado on complaints (company_id, status);

comment on table complaints is
  'Quejas del buzón 8.1 b). Contenido con estándar de dato sensible: sin GRANT para authenticated; lectura SOLO vía la app con evento queja_consultada fail-closed.';

-- Solo el estado es mutable; el contenido y la identidad del folio, jamás.
create or replace function app.queja_solo_estado() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.folio is distinct from old.folio
    or new.folio_key_hash is distinct from old.folio_key_hash
    or new.category is distinct from old.category
    or new.body is distinct from old.body
    or new.is_identified is distinct from old.is_identified
    or new.contact_name is distinct from old.contact_name
    or new.contact_info is distinct from old.contact_info
    or new.created_at is distinct from old.created_at
  then
    raise exception 'En complaints solo puede actualizarse status';
  end if;
  return new;
end;
$$;

create trigger complaints_solo_estado
  before update on complaints
  for each row execute function app.queja_solo_estado();
create trigger complaints_sin_delete
  before delete on complaints
  for each row execute function app.rechazar_modificacion();
create trigger complaints_sin_truncate
  before truncate on complaints
  for each statement execute function app.rechazar_modificacion();

create table complaint_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  complaint_id uuid not null,
  from_status text not null,
  to_status text not null,
  note text not null,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (company_id, complaint_id) references complaints (company_id, id)
);

create trigger complaint_events_inmutable
  before update or delete on complaint_events
  for each row execute function app.rechazar_modificacion();
create trigger complaint_events_sin_truncate
  before truncate on complaint_events
  for each statement execute function app.rechazar_modificacion();

alter table complaint_boxes enable row level security;
alter table complaints enable row level security;
alter table complaint_events enable row level security;

-- El enlace del buzón lo ve la gestión y el RD (lo difunden); lo escribe solo la app.
create policy complaint_boxes_select on complaint_boxes for select
  using (app.gestiona_tenant(company_id) or app.es_responsable_designado(company_id));

grant select on complaint_boxes to authenticated;
grant all on complaint_boxes to service_role;

-- complaints y complaint_events: SIN GRANT para authenticated (deliberado, patrón
-- risk_results): ni siquiera con una política pasarían — no hay privilegio.
grant all on complaints to service_role;
grant all on complaint_events to service_role;
