-- Fase 5: grants de soporte NOMINATIVOS con consentimiento del cliente (spec §6.2).
--
--  * El consentimiento lo crea el ADMIN DEL CLIENTE con su sesión vía RLS: acto
--    criptográficamente suyo, no un registro que la plataforma se auto-escribe.
--  * Decisión sellada 5a: el grant autoriza a UN operador (operator_user_id, FK a
--    platform_users), no "a la plataforma". Un grant del operador A no abre nada al B.
--  * Decisión sellada 5c: SIN break-glass. Si ningún admin del cliente puede otorgar,
--    soporte no entra. Ninguna fase futura debe "arreglar" esto.
--  * Tope duro 72h en CHECK (default de la UI: 24h). La revocación es lo único mutable
--    y en una sola dirección.

create table support_access_grants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  -- Decisión 5a: el grant es NOMINATIVO — autoriza a UN operador, no a "la plataforma".
  operator_user_id uuid not null references platform_users (id),
  -- Desnormalizado para que el tenant vea a quién autorizó sin poder leer platform_users.
  operator_email text not null,
  granted_by_user_id uuid not null, -- auth.uid() del admin_org que consiente (sin FK, convención audit_log)
  reason text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by_user_id uuid,
  constraint grant_duracion_maxima check (expires_at <= created_at + interval '72 hours'),
  constraint grant_expira_futuro check (expires_at > created_at)
);

comment on table support_access_grants is
  'Consentimiento temporal del cliente para que UN operador de plataforma vea su tenant en solo lectura. Sin grant vigente, el operador no ve NADA (autorizarSoporte, fail-closed por página).';

-- Solo pueden cambiar revoked_at/revoked_by_user_id, y solo de null a valor: extender
-- expires_at o reasignar el operador es un grant NUEVO, jamás una edición (amenaza 6).
create or replace function app.solo_revocacion() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.operator_user_id is distinct from old.operator_user_id
    or new.operator_email is distinct from old.operator_email
    or new.granted_by_user_id is distinct from old.granted_by_user_id
    or new.reason is distinct from old.reason
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at
  then
    raise exception 'En support_access_grants solo puede registrarse la revocación (revoked_at/revoked_by_user_id)';
  end if;
  if old.revoked_at is not null then
    raise exception 'El grant ya está revocado: la revocación es de una sola dirección';
  end if;
  return new;
end;
$$;

create trigger support_access_grants_solo_revocacion
  before update on support_access_grants
  for each row execute function app.solo_revocacion();

alter table support_access_grants enable row level security;

-- Todo el tenant VE los accesos otorgados (transparencia §6.6); solo es_admin_org otorga
-- y revoca; el consentimiento no se puede firmar a nombre de otro (granted_by = uid).
create policy grants_select on support_access_grants for select
  using (app.es_mi_tenant(company_id));
create policy grants_insert on support_access_grants for insert
  with check (app.es_admin_org(company_id) and granted_by_user_id = auth.uid());
create policy grants_update on support_access_grants for update
  using (app.es_admin_org(company_id))
  with check (app.es_admin_org(company_id));

-- Suspendido = solo lectura también aquí (§2.2, mecanismo RESTRICTIVE): un tenant no
-- activo NO otorga grants — para soportar a un suspendido, la plataforma usa sus
-- superficies propias (/admin/organizaciones/[id]), no la vista de tenant.
create policy support_access_grants_solo_activo_ins on support_access_grants
  as restrictive for insert
  with check (app.tenant_activo(company_id));
create policy support_access_grants_solo_activo_upd on support_access_grants
  as restrictive for update
  using (app.tenant_activo(company_id))
  with check (app.tenant_activo(company_id));
create policy support_access_grants_solo_activo_del on support_access_grants
  as restrictive for delete
  using (app.tenant_activo(company_id));

grant select, insert, update on support_access_grants to authenticated;
grant all on support_access_grants to service_role;
