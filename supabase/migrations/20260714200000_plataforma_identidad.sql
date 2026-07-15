-- Fase 5: identidad de plataforma (spec §1.1) y bitácora de plataforma (spec §4).
--
--  * platform_users gana ciclo de vida (invited/active/disabled). `disabled` es la baja
--    de operador — nunca DELETE (invited_by y la bitácora lo referencian). Sin columna
--    role (YAGNI: un solo rol de operador).
--  * Exclusión mutua operador↔tenant (frontera de seguridad, EN BD): una misma cuenta
--    auth no puede ser a la vez operador de plataforma y miembro de un tenant. Sin esto,
--    una sola sesión colapsa las dos identidades y el razonamiento de fronteras se cae.
--  * platform_audit_log: bitácora SEPARADA de audit_log (lectores disjuntos, retención
--    opuesta: la del tenant se purga con la baja; la de plataforma sobrevive como acta).

-- ─────────────────────────────────────────────────────────────────────────────
-- platform_users ampliada
-- ─────────────────────────────────────────────────────────────────────────────

alter table platform_users
  add column status text not null default 'invited'
    check (status in ('invited', 'active', 'disabled')),
  add column display_name text,
  add column invited_by uuid references platform_users (id),  -- null = bootstrap
  add column activated_at timestamptz,
  add column disabled_at timestamptz;

comment on column platform_users.status is
  'invited → active (al fijar contraseña + enrolar TOTP) → disabled (baja; nunca DELETE)';

-- La política propia_fila (SELECT de la fila propia) se conserva tal cual: es lo único
-- que autorizarPlataforma() lee con la sesión del operador. Cero escrituras para
-- authenticated (el GRANT existente es solo SELECT; patrón feature_flags).

-- ─────────────────────────────────────────────────────────────────────────────
-- Exclusión mutua operador↔tenant
-- ─────────────────────────────────────────────────────────────────────────────

-- SECURITY DEFINER: el trigger necesita leer platform_users y las tablas de membresía
-- completas; con derechos del invocador, la RLS de fila propia dejaría el check ciego.
create or replace function app.rechazar_identidad_dual() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
begin
  if tg_table_name = 'platform_users' then
    if exists (select 1 from role_assignments r where r.auth_user_id = new.auth_user_id)
      or exists (select 1 from employees e where e.auth_user_id = new.auth_user_id)
      or exists (select 1 from consultant_assignments c where c.consultant_user_id = new.auth_user_id)
    then
      raise exception 'Identidad dual prohibida: la cuenta % tiene membresía de tenant y no puede ser operador de plataforma',
        new.auth_user_id;
    end if;
    return new;
  end if;

  if tg_table_name = 'consultant_assignments' then
    v_uid := new.consultant_user_id;
  else
    v_uid := new.auth_user_id;
  end if;

  if v_uid is not null
    and exists (select 1 from platform_users p where p.auth_user_id = v_uid)
  then
    raise exception 'Identidad dual prohibida: la cuenta % es operador de plataforma y no puede tener membresía de tenant',
      v_uid;
  end if;
  return new;
end;
$$;

-- employees.auth_user_id se llena por UPDATE cuando el empleado usa su enlace (nace null):
-- el trigger cubre también ese UPDATE o la exclusión sería esquivable por esa vía.
create trigger role_assignments_identidad_dual
  before insert or update of auth_user_id on role_assignments
  for each row execute function app.rechazar_identidad_dual();

create trigger employees_identidad_dual
  before insert or update of auth_user_id on employees
  for each row execute function app.rechazar_identidad_dual();

create trigger consultant_assignments_identidad_dual
  before insert or update of consultant_user_id on consultant_assignments
  for each row execute function app.rechazar_identidad_dual();

create trigger platform_users_identidad_dual
  before insert on platform_users
  for each row execute function app.rechazar_identidad_dual();

-- ─────────────────────────────────────────────────────────────────────────────
-- Bitácora de plataforma
-- ─────────────────────────────────────────────────────────────────────────────

create table platform_audit_log (
  id bigint generated always as identity primary key,
  operator_id uuid references platform_users (id),  -- null = actor sistema (cron retención, scripts)
  event_type text not null,
  company_id uuid,          -- SIN FK a propósito: el acta de purga sobrevive a la empresa
  entity text,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table platform_audit_log is
  'Bitácora de actos de PLATAFORMA. Separada de audit_log: lectores disjuntos (el tenant jamás la lee), retención opuesta (sobrevive a la purga del tenant como acta). Solo service_role.';

alter table platform_audit_log enable row level security;
-- Cero políticas y cero GRANTs para authenticated/anon (patrón feature_flags de escritura):
-- el único camino es service_role tras autorizarPlataforma().

-- Append-only: la bitácora es evidencia, incluso frente al dueño de la tabla.
create trigger platform_audit_log_inmutable
  before update or delete on platform_audit_log
  for each row execute function app.rechazar_modificacion();

create trigger platform_audit_log_sin_truncate
  before truncate on platform_audit_log
  for each statement execute function app.rechazar_modificacion();

grant all on platform_audit_log to service_role;
