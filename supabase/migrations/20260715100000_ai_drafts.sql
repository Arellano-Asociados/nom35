-- Fase 6: borradores asistidos por IA (spec §4). Append-only con SELLO DEL INSUMO — la
-- terna (insumo_sha256, prompt_version, modelo) es la evidencia reproducible de QUÉ vio
-- la IA. La IA propone; el humano dispone y firma: adoptar es un acto del usuario con su
-- sesión (trigger app.solo_adopcion), y la IA jamás escribe en el programa.
--
--  * insumo jsonb: el JSON canónico EXACTO enviado a la IA — agregado YA suprimido
--    (legal almacenarlo) y prueba de qué recibió el proveedor.
--  * Regenerar = fila nueva (append-only, como toda evidencia); adoptar = UPDATE de una
--    sola dirección de adopted_by/adopted_at.

create table ai_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  cycle_id uuid not null,
  tipo text not null check (tipo in ('resumen_ejecutivo', 'plan_accion')),
  texto text not null,
  modelo text not null,
  prompt_version text not null, -- p. ej. 'resumen_v1'
  insumo jsonb not null, -- JSON canónico EXACTO enviado (ya suprimido)
  insumo_sha256 text not null,
  generated_by uuid not null, -- auth.uid() (sin FK, convención audit_log)
  created_at timestamptz not null default now(),
  adopted_by uuid,
  adopted_at timestamptz,
  foreign key (company_id, cycle_id) references compliance_cycles (company_id, id)
);

comment on table ai_drafts is
  'Borradores asistidos por IA (resumen ejecutivo / plan de acción). Append-only con el insumo suprimido sellado. La IA propone; el humano adopta (solo_adopcion) y firma.';

-- Adopción de una sola dirección (patrón solo_revocacion de F5): en UPDATE solo pueden
-- cambiar adopted_by/adopted_at, de null a valor, una vez. Cualquier otro cambio (incluido
-- el texto o el insumo) = exception: el borrador es inmutable, adoptarlo no lo reescribe.
create or replace function app.solo_adopcion() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.cycle_id is distinct from old.cycle_id
    or new.tipo is distinct from old.tipo
    or new.texto is distinct from old.texto
    or new.modelo is distinct from old.modelo
    or new.prompt_version is distinct from old.prompt_version
    or new.insumo is distinct from old.insumo
    or new.insumo_sha256 is distinct from old.insumo_sha256
    or new.generated_by is distinct from old.generated_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'En ai_drafts solo puede registrarse la adopción (adopted_by/adopted_at)';
  end if;
  if old.adopted_at is not null then
    raise exception 'El borrador ya fue adoptado: la adopción es de una sola dirección';
  end if;
  return new;
end;
$$;

create trigger ai_drafts_solo_adopcion
  before update on ai_drafts
  for each row execute function app.solo_adopcion();

-- Append-only: regenerar es fila nueva; el historial de borradores es parte del rastro.
create trigger ai_drafts_inmutable
  before delete on ai_drafts
  for each row execute function app.rechazar_modificacion();

create trigger ai_drafts_sin_truncate
  before truncate on ai_drafts
  for each statement execute function app.rechazar_modificacion();

alter table ai_drafts enable row level security;

-- Gestión (admin_org o consultor) lee, genera y adopta en SU tenant; generar es un acto
-- del usuario (generated_by = auth.uid()), auditado.
create policy ai_drafts_select on ai_drafts for select
  using (app.gestiona_tenant(company_id));
create policy ai_drafts_insert on ai_drafts for insert
  with check (app.gestiona_tenant(company_id) and generated_by = auth.uid());
create policy ai_drafts_update on ai_drafts for update
  using (app.gestiona_tenant(company_id))
  with check (app.gestiona_tenant(company_id));

-- Suspendido = solo lectura a nivel de BD (consecuencia F5 §2.2: toda tabla de tenant
-- nueva añade sus RESTRICTIVE). Generar/adoptar llama a una API que cuesta dinero: es
-- operación, no atención a la salud.
create policy ai_drafts_solo_activo_ins on ai_drafts
  as restrictive for insert
  with check (app.tenant_activo(company_id));
create policy ai_drafts_solo_activo_upd on ai_drafts
  as restrictive for update
  using (app.tenant_activo(company_id))
  with check (app.tenant_activo(company_id));
create policy ai_drafts_solo_activo_del on ai_drafts
  as restrictive for delete
  using (app.tenant_activo(company_id));

grant select, insert, update on ai_drafts to authenticated;
grant all on ai_drafts to service_role;

-- Trazabilidad de las acciones del programa originadas en un borrador de IA (spec §7):
-- el PDF del programa lo declara junto al responsable que ya firma.
alter table action_items add column ai_assisted boolean not null default false;
