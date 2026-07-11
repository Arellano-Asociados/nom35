-- RLS de tablas de tenant.
-- Política base: company_id = (auth.jwt() ->> 'company_id')::uuid, SIEMPRE reforzada con
-- membresía real (role_assignments / employees): un claim manipulado sin filas de membresía
-- no da acceso. Consultores acceden vía consultant_assignments (sin depender del claim).
-- Reglas de acceso a datos sensibles:
--  * responses: SIN política de SELECT. Nadie del lado patronal (ni empleado) lee respuestas
--    crudas por PostgREST; solo el backend con service_role (que salta RLS) para calcular.
--  * risk_results / gr1_results: SELECT solo Responsable Designado y el propio empleado.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers (security definer para evitar recursión de RLS en las tablas de membresía)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function app.jwt_company_id() returns uuid
language sql stable as $$
  select nullif(coalesce(auth.jwt() ->> 'company_id', ''), '')::uuid
$$;

create or replace function app.es_mi_tenant(cid uuid) returns boolean
language sql stable as $$
  select cid is not null and cid = app.jwt_company_id()
$$;

create or replace function app.es_admin_org(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.es_mi_tenant(cid) and exists (
    select 1 from role_assignments
    where company_id = cid and auth_user_id = auth.uid() and role = 'admin_org'
  )
$$;

create or replace function app.es_consultor_de(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select cid is not null and exists (
    select 1 from consultant_assignments
    where company_id = cid and consultant_user_id = auth.uid()
  )
$$;

create or replace function app.es_responsable_designado(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.es_mi_tenant(cid) and exists (
    select 1 from role_assignments
    where company_id = cid and auth_user_id = auth.uid() and is_designated_responsible
  )
$$;

-- Admin Org o Consultor asignado: los roles que operan el panel administrativo
create or replace function app.gestiona_tenant(cid uuid) returns boolean
language sql stable as $$
  select app.es_admin_org(cid) or app.es_consultor_de(cid)
$$;

create or replace function app.es_empleado(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eid is not null and exists (
    select 1 from employees where id = eid and auth_user_id = auth.uid()
  )
$$;

create or replace function app.es_miembro(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.es_mi_tenant(cid) and exists (
    select 1 from employees where company_id = cid and auth_user_id = auth.uid()
  )
$$;

-- El empleado autenticado puede responder este assignment (vigente y no completado)
create or replace function app.puede_responder(aid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.es_mi_tenant(cid) and exists (
    select 1
    from questionnaire_assignments qa
    join employees e on e.id = qa.employee_id and e.company_id = qa.company_id
    where qa.id = aid
      and qa.company_id = cid
      and e.auth_user_id = auth.uid()
      and qa.completed_at is null
      and qa.expires_at > now()
  )
$$;

grant execute on all functions in schema app to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Hook de access token: agrega company_id al JWT desde la membresía real
-- (config.toml → [auth.hook.custom_access_token])
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function app.custom_access_token(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  cid uuid;
begin
  select company_id into cid
  from role_assignments
  where auth_user_id = (event ->> 'user_id')::uuid
  limit 1;

  if cid is null then
    select company_id into cid
    from employees
    where auth_user_id = (event ->> 'user_id')::uuid
    limit 1;
  end if;

  if cid is not null then
    event := jsonb_set(event, '{claims,company_id}', to_jsonb(cid::text));
  end if;

  return event;
end;
$$;

grant execute on function app.custom_access_token(jsonb) to supabase_auth_admin;

-- ─────────────────────────────────────────────────────────────────────────────
-- Habilitar RLS en TODAS las tablas de tenant
-- ─────────────────────────────────────────────────────────────────────────────

alter table companies enable row level security;
alter table work_centers enable row level security;
alter table employees enable row level security;
alter table role_assignments enable row level security;
alter table consultant_assignments enable row level security;
alter table compliance_cycles enable row level security;
alter table questionnaire_assignments enable row level security;
alter table consents enable row level security;
alter table responses enable row level security;
alter table risk_results enable row level security;
alter table gr1_results enable row level security;
alter table action_items enable row level security;
alter table policies enable row level security;
alter table policy_acknowledgments enable row level security;
alter table training_contents enable row level security;
alter table training_records enable row level security;
alter table compliance_reports enable row level security;
alter table audit_log enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Políticas
-- ─────────────────────────────────────────────────────────────────────────────

-- companies: la ve quien la gestiona, el Responsable Designado o cualquier miembro (empleado)
create policy companies_select on companies for select
  using (app.gestiona_tenant(id) or app.es_responsable_designado(id) or app.es_miembro(id));
create policy companies_update on companies for update
  using (app.es_admin_org(id)) with check (app.es_admin_org(id));

-- work_centers
create policy work_centers_select on work_centers for select
  using (app.gestiona_tenant(company_id));
create policy work_centers_insert on work_centers for insert
  with check (app.gestiona_tenant(company_id));
create policy work_centers_update on work_centers for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));
create policy work_centers_delete on work_centers for delete
  using (app.gestiona_tenant(company_id));

-- employees: gestión + cada empleado ve su propia fila
create policy employees_select on employees for select
  using (app.gestiona_tenant(company_id) or auth_user_id = auth.uid());
create policy employees_insert on employees for insert
  with check (app.gestiona_tenant(company_id));
create policy employees_update on employees for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));
create policy employees_delete on employees for delete
  using (app.gestiona_tenant(company_id));

-- role_assignments: administra el Admin Org; cada usuario ve las suyas
create policy role_assignments_select on role_assignments for select
  using (app.es_admin_org(company_id) or auth_user_id = auth.uid());
create policy role_assignments_insert on role_assignments for insert
  with check (app.es_admin_org(company_id));
create policy role_assignments_update on role_assignments for update
  using (app.es_admin_org(company_id)) with check (app.es_admin_org(company_id));
create policy role_assignments_delete on role_assignments for delete
  using (app.es_admin_org(company_id));

-- consultant_assignments: administra el Admin Org; el consultor ve las suyas
create policy consultant_assignments_select on consultant_assignments for select
  using (app.es_admin_org(company_id) or consultant_user_id = auth.uid());
create policy consultant_assignments_insert on consultant_assignments for insert
  with check (app.es_admin_org(company_id));
create policy consultant_assignments_delete on consultant_assignments for delete
  using (app.es_admin_org(company_id));

-- compliance_cycles
create policy compliance_cycles_select on compliance_cycles for select
  using (app.gestiona_tenant(company_id));
create policy compliance_cycles_insert on compliance_cycles for insert
  with check (app.gestiona_tenant(company_id));
create policy compliance_cycles_update on compliance_cycles for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));

-- questionnaire_assignments: gestión (el token está hasheado) + el empleado ve las suyas
create policy assignments_select on questionnaire_assignments for select
  using (app.gestiona_tenant(company_id) or app.es_empleado(employee_id));
create policy assignments_insert on questionnaire_assignments for insert
  with check (app.gestiona_tenant(company_id));
create policy assignments_update on questionnaire_assignments for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));
create policy assignments_delete on questionnaire_assignments for delete
  using (app.gestiona_tenant(company_id));

-- consents: el empleado registra el suyo; lectura para gestión (evidencia de participación)
create policy consents_select on consents for select
  using (app.gestiona_tenant(company_id) or app.es_empleado(employee_id));
create policy consents_insert on consents for insert
  with check (app.es_empleado(employee_id) and app.es_mi_tenant(company_id));

-- responses: SOLO INSERT por el empleado dueño del assignment vigente. SIN SELECT para nadie.
create policy responses_insert on responses for insert
  with check (app.puede_responder(assignment_id, company_id));

-- risk_results: SELECT solo Responsable Designado (acceso auditado por la app) y el empleado
create policy risk_results_select on risk_results for select
  using (app.es_responsable_designado(company_id) or app.es_empleado(employee_id));

-- gr1_results: SELECT Responsable Designado y empleado; UPDATE (canalización) solo RD
create policy gr1_results_select on gr1_results for select
  using (app.es_responsable_designado(company_id) or app.es_empleado(employee_id));
create policy gr1_results_update on gr1_results for update
  using (app.es_responsable_designado(company_id))
  with check (app.es_responsable_designado(company_id));

-- action_items
create policy action_items_select on action_items for select
  using (app.gestiona_tenant(company_id));
create policy action_items_insert on action_items for insert
  with check (app.gestiona_tenant(company_id));
create policy action_items_update on action_items for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));
create policy action_items_delete on action_items for delete
  using (app.gestiona_tenant(company_id));

-- policies (política de prevención): gestión escribe; los empleados la leen (deben acusarla)
create policy policies_select on policies for select
  using (app.gestiona_tenant(company_id) or app.es_miembro(company_id));
create policy policies_insert on policies for insert
  with check (app.gestiona_tenant(company_id));
create policy policies_update on policies for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));

-- policy_acknowledgments: el empleado acusa; lectura para gestión y el propio empleado
create policy policy_acks_select on policy_acknowledgments for select
  using (app.gestiona_tenant(company_id) or app.es_empleado(employee_id));
create policy policy_acks_insert on policy_acknowledgments for insert
  with check (app.es_empleado(employee_id) and app.es_mi_tenant(company_id));

-- training_contents / training_records
create policy training_contents_select on training_contents for select
  using (app.gestiona_tenant(company_id) or app.es_miembro(company_id));
create policy training_contents_insert on training_contents for insert
  with check (app.gestiona_tenant(company_id));
create policy training_contents_update on training_contents for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));

create policy training_records_select on training_records for select
  using (app.gestiona_tenant(company_id) or app.es_empleado(employee_id));
create policy training_records_insert on training_records for insert
  with check (app.gestiona_tenant(company_id));

-- compliance_reports: solo lectura/registro por gestión (el hash queda auditado)
create policy compliance_reports_select on compliance_reports for select
  using (app.gestiona_tenant(company_id));
create policy compliance_reports_insert on compliance_reports for insert
  with check (app.gestiona_tenant(company_id));

-- audit_log: cualquier usuario del tenant registra SUS eventos; lectura para gestión
create policy audit_log_insert on audit_log for insert
  with check (
    actor_user_id = auth.uid()
    and (app.es_mi_tenant(company_id) or app.es_consultor_de(company_id))
  );
create policy audit_log_select on audit_log for select
  using (app.gestiona_tenant(company_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants por tabla (capa gruesa, mínimo privilegio; RLS es la capa fina).
-- CONVENCIÓN: toda tabla nueva necesita su GRANT explícito — no hay default privileges.
-- Nótese que responses NO tiene GRANT de SELECT para authenticated: la prohibición de
-- leer respuestas crudas queda reforzada también en la capa de privilegios.
-- ─────────────────────────────────────────────────────────────────────────────

grant select, update on companies to authenticated;
grant select, insert, update, delete on work_centers to authenticated;
grant select, insert, update, delete on employees to authenticated;
grant select, insert, update, delete on role_assignments to authenticated;
grant select, insert, delete on consultant_assignments to authenticated;
grant select, insert, update on compliance_cycles to authenticated;
grant select, insert, update, delete on questionnaire_assignments to authenticated;
grant select, insert on consents to authenticated;
grant insert on responses to authenticated; -- SIN select: nadie lee respuestas crudas
grant select on risk_results to authenticated;
grant select, update on gr1_results to authenticated;
grant select, insert, update, delete on action_items to authenticated;
grant select, insert, update on policies to authenticated;
grant select, insert on policy_acknowledgments to authenticated;
grant select, insert, update on training_contents to authenticated;
grant select, insert on training_records to authenticated;
grant select, insert on compliance_reports to authenticated;
grant select, insert on audit_log to authenticated;
grant select on work_centers_alerta_ciclo to authenticated;

grant all on companies, work_centers, employees, role_assignments, consultant_assignments,
  compliance_cycles, questionnaire_assignments, consents, responses, risk_results, gr1_results,
  action_items, policies, policy_acknowledgments, training_contents, training_records,
  compliance_reports, audit_log to service_role;
grant select on work_centers_alerta_ciclo to service_role;
