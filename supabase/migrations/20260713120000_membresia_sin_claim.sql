-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2.5: la membresía real manda; el claim del JWT deja de ser condición.
--
-- Con el panel operando como el usuario (cliente de sesión), la condición
-- `app.es_mi_tenant(cid)` (claim company_id del JWT == cid) rompía dos flujos
-- legítimos:
--   1. Recién creada una empresa, el JWT vigente se emitió ANTES de la membresía:
--      el claim no la trae hasta el refresh del token → el creador quedaba fuera
--      de su propia empresa.
--   2. El claim es de UNA sola empresa: un admin_org con dos empresas (o el mismo
--      patrón consultora) solo podría operar la del claim.
--
-- El claim nunca fue suficiente (las políticas siempre re-verificaron membresía);
-- ahora tampoco es necesario: la fuente de verdad es role_assignments/employees
-- por auth.uid(), exactamente como ya funcionaba app.es_consultor_de. Un claim
-- manipulado sigue sin dar nada (la suite lo cubre) y un JWT legítimo sin claim
-- fresco deja de bloquear al miembro real.
-- ─────────────────────────────────────────────────────────────────────────────

-- Membresía en el tenant (cualquier vía): reemplaza la comparación con el claim.
create or replace function app.es_mi_tenant(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select cid is not null and (
    exists (select 1 from role_assignments where company_id = cid and auth_user_id = auth.uid())
    or exists (select 1 from employees where company_id = cid and auth_user_id = auth.uid())
    or exists (select 1 from consultant_assignments where company_id = cid and consultant_user_id = auth.uid())
  )
$$;

create or replace function app.es_admin_org(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select cid is not null and exists (
    select 1 from role_assignments
    where company_id = cid and auth_user_id = auth.uid() and role = 'admin_org'
  )
$$;

create or replace function app.es_responsable_designado(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select cid is not null and exists (
    select 1 from role_assignments
    where company_id = cid and auth_user_id = auth.uid() and is_designated_responsible
  )
$$;

create or replace function app.es_miembro(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select cid is not null and exists (
    select 1 from employees where company_id = cid and auth_user_id = auth.uid()
  )
$$;

-- puede_responder ya no exige claim: el empleado por sesión no existe hoy (flujo por
-- token con service_role), pero si existiera, su membresía real es la que cuenta.
create or replace function app.puede_responder(aid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
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
