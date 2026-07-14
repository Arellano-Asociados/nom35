-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 4.5: acontecimientos traumáticos severos (NOM-035 5.3, 5.5, 6.5).
--
-- Los numerales operan de forma CONTINUA, no por ciclo: el trabajador informa por
-- escrito el acontecimiento traumático severo (ATS) y el patrón identifica a quienes
-- lo presenciaron o sufrieron para aplicarles la Guía de Referencia I y, en su caso,
-- canalizarlos a atención clínica. Hasta ahora la GR-I solo se distribuía al crear un
-- ciclo de evaluación, así que un ATS ocurrido a mitad de año no tenía cauce.
--
-- Diseño (máxima reutilización): un evento ATS crea internamente un compliance_cycles
-- PROPIO marcado con traumatic_event_id. Con eso el mecanismo existente completo
-- —tokens, expiración, flujo del empleado GR-I, gr1_results, notificación al RD,
-- canalizaciones, acceso individual auditado— funciona sin tocarse. Lo único nuevo es
-- el registro del evento y la distribución DIRIGIDA (solo a los expuestos, solo GR-I).
--
-- traumatic_events es APPEND-ONLY: el registro del evento es evidencia ante la STPS;
-- una corrección se hace registrando un evento nuevo, jamás editando el anterior.
-- ─────────────────────────────────────────────────────────────────────────────

create table traumatic_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  work_center_id uuid not null,
  -- Fecha en que ocurrió el acontecimiento (5.3: el trabajador lo informa por escrito).
  occurred_on date not null,
  -- Descripción del HECHO (p. ej. "asalto a mano armada en la sucursal").
  -- NUNCA datos de salud de una persona: eso es resultado individual y vive en gr1_results.
  description text not null,
  reported_by uuid not null,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, work_center_id) references work_centers (company_id, id)
);

comment on table traumatic_events is
  'Acontecimientos traumáticos severos (5.3/5.5/6.5). APPEND-ONLY: es evidencia; corregir = registrar un evento nuevo. description documenta el hecho, jamás datos de salud.';

create trigger traumatic_events_inmutable
  before update or delete on traumatic_events
  for each row execute function app.rechazar_modificacion();
create trigger traumatic_events_sin_truncate
  before truncate on traumatic_events
  for each statement execute function app.rechazar_modificacion();

alter table traumatic_events enable row level security;

-- Lectura para gestión y RD (el RD atiende la canalización clínica derivada del evento).
create policy traumatic_events_select on traumatic_events for select
  using (app.gestiona_tenant(company_id) or app.es_responsable_designado(company_id));
-- Solo gestión registra, y no puede suplantar a otro como quien reporta.
create policy traumatic_events_insert on traumatic_events for insert
  with check (app.gestiona_tenant(company_id) and reported_by = auth.uid());
-- Sin políticas de UPDATE/DELETE: append-only (los triggers lo rechazan de todos modos).

grant select, insert on traumatic_events to authenticated;
grant all on traumatic_events to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Ciclos de evaluación: marca de origen ATS
-- ─────────────────────────────────────────────────────────────────────────────

alter table compliance_cycles
  add column traumatic_event_id uuid,
  add constraint compliance_cycles_traumatic_event_fk
    foreign key (company_id, traumatic_event_id) references traumatic_events (company_id, id);

comment on column compliance_cycles.traumatic_event_id is
  'No nulo => el ciclo es la aplicación reactiva de GR-I por un ATS, no una evaluación ordinaria. Se excluye de la alerta bienal y de la lista de Ciclos del panel.';

-- La alerta del 7.9 (reevaluar al menos cada dos años) habla de la evaluación ORDINARIA.
-- Un evento ATS aplica GR-I a unos pocos expuestos: no evalúa el centro y por tanto no
-- puede apagar la alerta bienal. Se recrea la vista excluyendo los ciclos ATS.
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
  where traumatic_event_id is null
  group by work_center_id
) ult on ult.work_center_id = wc.id;
