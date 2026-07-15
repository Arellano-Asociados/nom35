-- Fase 5: estados de organización y suspensión BD-primero (spec §2.1–§2.2).
--
-- NOTA DE DISEÑO (resolución acordada con el propietario, 2026-07-14): el spec §2.2
-- proponía inyectar app.tenant_activo() DENTRO de gestiona_tenant/es_admin_org,
-- asumiendo que solo las políticas de escritura delegan en esos helpers. Verificado en
-- pg_policies: 26 políticas de SELECT también delegan en ellos; la inyección habría
-- dejado al tenant suspendido sin LECTURA alguna, contra la decisión sellada 2 (solo
-- lectura TOTAL, con descargas). Mecanismo elegido en su lugar: políticas RESTRICTIVE
-- por comando de escritura — Postgres las combina con AND sobre las permisivas — sobre
-- toda tabla de tenant. Helpers y políticas existentes intactos; las lecturas
-- sobreviven; toda escritura de un tenant no activo muere en BD (la defensa real).
-- Las tablas de tenant FUTURAS deben añadir sus propias RESTRICTIVE en su migración.

alter table companies
  add column status text not null default 'active'
    check (status in ('active', 'suspended', 'pending_deletion')),
  add column status_changed_at timestamptz,
  add column suspension_reason text,
  add column deletion_requested_at timestamptz;

comment on column companies.status is
  'Transiciones (solo plataforma, validadas en la acción): active ↔ suspended; active|suspended → pending_deletion; pending_deletion → suspended (arrepentimiento). La purga física es solo por script manual, nunca UPDATE.';

create function app.tenant_activo(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from companies where id = cid and status = 'active')
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Suspendido = solo lectura, a nivel de BD
-- ─────────────────────────────────────────────────────────────────────────────
-- Exclusiones del candado:
--  * platform_audit_log: tabla de PLATAFORMA (su company_id es un dato, no tenancy).
--  * gr1_results: la canalización clínica del RD SOBREVIVE a la suspensión — es
--    atención a la salud del trabajador, no operación comercial (excepción explícita
--    del spec §2.2, aceptada). Su única vía de escritura ya es la app con service_role
--    (sin GRANT para authenticated), coherente en ambas capas.
do $$
declare t text;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('platform_audit_log', 'gr1_results')
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'company_id' and not a.attisdropped
      )
  loop
    execute format(
      'create policy %I on %I as restrictive for insert with check (app.tenant_activo(company_id))',
      t || '_solo_activo_ins', t);
    execute format(
      'create policy %I on %I as restrictive for update using (app.tenant_activo(company_id)) with check (app.tenant_activo(company_id))',
      t || '_solo_activo_upd', t);
    execute format(
      'create policy %I on %I as restrictive for delete using (app.tenant_activo(company_id))',
      t || '_solo_activo_del', t);
  end loop;
end $$;

-- companies no tiene company_id: su id ES el tenant. El candado de UPDATE va aparte.
create policy companies_solo_activo_upd on companies
  as restrictive for update
  using (app.tenant_activo(id))
  with check (app.tenant_activo(id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Amenaza 12: el admin_org no se auto-reactiva (ni se auto-suspende)
-- ─────────────────────────────────────────────────────────────────────────────
-- El GRANT de UPDATE sobre companies era de tabla completa: las columnas nuevas de
-- estado quedarían editables por la política companies_update (es_admin_org). Se baja
-- a GRANT por columnas: el estado es EXCLUSIVO de la plataforma (service_role).
revoke update on companies from authenticated;
grant update (legal_name, rfc, privacy_notice_version) on companies to authenticated;
