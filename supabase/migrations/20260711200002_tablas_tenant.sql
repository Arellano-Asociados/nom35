-- Tablas de tenant. Reglas inviolables aplicadas A NIVEL DE BASE DE DATOS:
--  * responses, risk_results, audit_log y consents son append-only (triggers rechazan
--    UPDATE/DELETE/TRUNCATE). Recálculo = fila nueva con supersedes_id.
--  * gr1_results solo admite UPDATE de los campos de canalización.
--  * work_centers.nom_category se deriva por trigger del headcount (umbrales 15/16 y 50/51).
--  * Integridad anti-cruce de tenant: las cadenas de FKs son compuestas (company_id, id),
--    de modo que un hijo no puede apuntar a un padre de otra empresa.

-- ─────────────────────────────────────────────────────────────────────────────
-- Funciones de trigger
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function app.rechazar_modificacion() returns trigger
language plpgsql as $$
begin
  raise exception 'La tabla % es append-only: % está prohibido (regla inviolable de inmutabilidad)',
    tg_table_name, tg_op;
end;
$$;

create or replace function app.derivar_nom_category() returns trigger
language plpgsql as $$
begin
  if new.headcount <= 15 then
    new.nom_category := 'solo_gr1';
  elsif new.headcount <= 50 then
    new.nom_category := 'gr1_gr2';
  else
    new.nom_category := 'gr1_gr3';
  end if;
  return new;
end;
$$;

create or replace function app.gr1_solo_canalizacion() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.assignment_id is distinct from old.assignment_id
    or new.employee_id is distinct from old.employee_id
    or new.cycle_id is distinct from old.cycle_id
    or new.presento_acontecimiento is distinct from old.presento_acontecimiento
    or new.requiere_valoracion is distinct from old.requiere_valoracion
    or new.secciones_disparadas is distinct from old.secciones_disparadas
    or new.created_at is distinct from old.created_at
  then
    raise exception 'En gr1_results solo pueden actualizarse canalizacion_estatus y canalizacion_fecha';
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Estructura organizacional
-- ─────────────────────────────────────────────────────────────────────────────

create table companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  rfc text,
  privacy_notice_version text,
  created_at timestamptz not null default now()
);

create table work_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  name text not null,
  address text,
  main_activity text,
  headcount integer not null check (headcount >= 1),
  nom_category text not null check (nom_category in ('solo_gr1', 'gr1_gr2', 'gr1_gr3')),
  created_at timestamptz not null default now(),
  unique (company_id, id)
);

create trigger work_centers_nom_category
  before insert or update on work_centers
  for each row execute function app.derivar_nom_category();

create table employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  work_center_id uuid not null,
  -- auth_user_id se llena cuando el empleado usa su magic link (sin FK a auth.users:
  -- los empleados se dan de alta antes de tener cuenta)
  auth_user_id uuid,
  full_name text not null,
  email citext not null,
  area text,
  attends_customers boolean not null default false,
  supervises_others boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, email),
  unique (company_id, id),
  foreign key (company_id, work_center_id) references work_centers (company_id, id)
);

create table role_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  auth_user_id uuid not null,
  -- 'miembro' no otorga permisos por sí mismo: existe para portar el flag de
  -- Responsable Designado en usuarios que no son Admin de Organización
  role text not null check (role in ('admin_org', 'miembro')),
  -- El permiso de Responsable Designado es un flag adicional, no un rol
  is_designated_responsible boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, auth_user_id)
);

create table consultant_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  consultant_user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (company_id, consultant_user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Ciclos de cumplimiento y aplicación de cuestionarios
-- ─────────────────────────────────────────────────────────────────────────────

create table compliance_cycles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  work_center_id uuid not null,
  name text not null,
  date_start date not null,
  date_end date,
  evaluator_name text not null,
  evaluator_license text not null,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, work_center_id) references work_centers (company_id, id)
);

-- Alerta del numeral 7.9: la evaluación debe repetirse al menos cada dos años.
create or replace view work_centers_alerta_ciclo
  with (security_invoker = true) as
select
  wc.id as work_center_id,
  wc.company_id,
  wc.name,
  ult.ultima_evaluacion,
  (ult.ultima_evaluacion is null
    or ult.ultima_evaluacion < (current_date - interval '24 months')) as requiere_nueva_evaluacion
from work_centers wc
left join (
  select work_center_id, max(coalesce(date_end, date_start)) as ultima_evaluacion
  from compliance_cycles
  group by work_center_id
) ult on ult.work_center_id = wc.id;

create table questionnaire_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  cycle_id uuid not null,
  employee_id uuid not null,
  questionnaire_id uuid not null references questionnaires (id),
  -- Solo el hash del token viaja a la BD; el token en claro solo existe en el enlace enviado
  token_hash text not null unique,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (cycle_id, employee_id, questionnaire_id),
  foreign key (company_id, cycle_id) references compliance_cycles (company_id, id),
  foreign key (company_id, employee_id) references employees (company_id, id)
);

create table consents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  assignment_id uuid not null,
  employee_id uuid not null,
  privacy_text_version text not null,
  accepted_at timestamptz not null default now(),
  ip inet,
  unique (assignment_id),
  foreign key (company_id, assignment_id) references questionnaire_assignments (company_id, id),
  foreign key (company_id, employee_id) references employees (company_id, id)
);

create trigger consents_inmutable
  before update or delete on consents
  for each row execute function app.rechazar_modificacion();
create trigger consents_sin_truncate
  before truncate on consents
  for each statement execute function app.rechazar_modificacion();

-- ─────────────────────────────────────────────────────────────────────────────
-- Respuestas y resultados (INMUTABLES)
-- ─────────────────────────────────────────────────────────────────────────────

create table responses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  assignment_id uuid not null,
  section text check (section in ('I', 'II', 'III', 'IV')),
  item_number integer not null check (item_number > 0),
  -- Likert para GR-II/GR-III; 'si'/'no' para GR-I
  answer text not null check (
    answer in ('siempre', 'casi_siempre', 'algunas_veces', 'casi_nunca', 'nunca', 'si', 'no')
  ),
  answered_at timestamptz not null default now(),
  unique nulls not distinct (assignment_id, section, item_number),
  foreign key (company_id, assignment_id) references questionnaire_assignments (company_id, id)
);

comment on table responses is
  'Respuestas crudas. APPEND-ONLY por trigger. Ningún rol patronal tiene política de SELECT: solo el backend (service_role) las lee para calcular.';

create trigger responses_inmutable
  before update or delete on responses
  for each row execute function app.rechazar_modificacion();
create trigger responses_sin_truncate
  before truncate on responses
  for each statement execute function app.rechazar_modificacion();

create table risk_results (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  assignment_id uuid not null,
  employee_id uuid not null,
  cycle_id uuid not null,
  questionnaire_id uuid not null references questionnaires (id),
  cfinal numeric not null,
  nivel_final text not null check (nivel_final in ('nulo', 'bajo', 'medio', 'alto', 'muy_alto')),
  categorias jsonb not null,
  dominios jsonb not null,
  engine_version text not null,
  -- Recálculo = fila nueva que reemplaza a la anterior; nunca UPDATE
  supersedes_id uuid references risk_results (id),
  created_at timestamptz not null default now(),
  foreign key (company_id, assignment_id) references questionnaire_assignments (company_id, id),
  foreign key (company_id, employee_id) references employees (company_id, id),
  foreign key (company_id, cycle_id) references compliance_cycles (company_id, id)
);

create trigger risk_results_inmutable
  before update or delete on risk_results
  for each row execute function app.rechazar_modificacion();
create trigger risk_results_sin_truncate
  before truncate on risk_results
  for each statement execute function app.rechazar_modificacion();

create table gr1_results (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  assignment_id uuid not null,
  employee_id uuid not null,
  cycle_id uuid not null,
  presento_acontecimiento boolean not null,
  requiere_valoracion boolean not null,
  secciones_disparadas text[] not null default '{}',
  canalizacion_estatus text not null default 'pendiente'
    check (canalizacion_estatus in ('pendiente', 'canalizado', 'atendido')),
  canalizacion_fecha date,
  created_at timestamptz not null default now(),
  foreign key (company_id, assignment_id) references questionnaire_assignments (company_id, id),
  foreign key (company_id, employee_id) references employees (company_id, id),
  foreign key (company_id, cycle_id) references compliance_cycles (company_id, id)
);

create trigger gr1_results_solo_canalizacion
  before update on gr1_results
  for each row execute function app.gr1_solo_canalizacion();
create trigger gr1_results_sin_delete
  before delete on gr1_results
  for each row execute function app.rechazar_modificacion();
create trigger gr1_results_sin_truncate
  before truncate on gr1_results
  for each statement execute function app.rechazar_modificacion();

-- ─────────────────────────────────────────────────────────────────────────────
-- Acciones, política, capacitación, informes y auditoría
-- ─────────────────────────────────────────────────────────────────────────────

create table action_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  cycle_id uuid not null,
  description text not null,
  origin_level text not null check (origin_level in ('nulo', 'bajo', 'medio', 'alto', 'muy_alto')),
  responsible text not null,
  due_date date,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'en_progreso', 'completada')),
  created_at timestamptz not null default now(),
  foreign key (company_id, cycle_id) references compliance_cycles (company_id, id)
);

create table policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  title text not null,
  version text not null,
  storage_path text not null,
  published_at timestamptz not null default now(),
  unique (company_id, id)
);

create table policy_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  policy_id uuid not null,
  employee_id uuid not null,
  acknowledged_at timestamptz not null default now(),
  unique (policy_id, employee_id),
  foreign key (company_id, policy_id) references policies (company_id, id),
  foreign key (company_id, employee_id) references employees (company_id, id)
);

create table training_contents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  title text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (company_id, id)
);

create table training_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  training_id uuid not null,
  employee_id uuid not null,
  completed_at timestamptz not null default now(),
  unique (training_id, employee_id),
  foreign key (company_id, training_id) references training_contents (company_id, id),
  foreign key (company_id, employee_id) references employees (company_id, id)
);

create table compliance_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  cycle_id uuid not null,
  report_type text not null check (report_type in ('informe_79', 'expediente_zip', 'export_excel')),
  storage_path text not null,
  sha256 text not null,
  created_at timestamptz not null default now(),
  foreign key (company_id, cycle_id) references compliance_cycles (company_id, id)
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  actor_user_id uuid not null,
  event_type text not null,
  entity text,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table audit_log is
  'Bitácora append-only. Evento individual_result_access obligatorio en cada consulta de resultados individuales por el Responsable Designado.';

create trigger audit_log_inmutable
  before update or delete on audit_log
  for each row execute function app.rechazar_modificacion();
create trigger audit_log_sin_truncate
  before truncate on audit_log
  for each statement execute function app.rechazar_modificacion();
