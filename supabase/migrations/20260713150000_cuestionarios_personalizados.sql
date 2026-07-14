-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3: cuestionarios personalizados (adicionales a las guías oficiales).
--
-- PRINCIPIOS (indicaciones del propietario):
--  * Las 3 guías oficiales son INTOCABLES: viven en questionnaires/questions con su
--    gate verificar:textos; esto es un catálogo APARTE, por tenant, bajo RLS.
--  * Ciclo de vida borrador → publicado → archivado. PUBLICADO ES INMUTABLE
--    (coherente con la filosofía de evidencia): el trigger rechaza cualquier cambio
--    de contenido; solo se permite archivar. Cambios = nueva versión (fila nueva,
--    misma familia_id, version+1). Al publicar se sella sha256 de la definición.
--  * NO generan semáforo ni entran al informe 7.9: sus respuestas viven en
--    custom_answers y se reportan aparte, en agregados simples.
--  * custom_answers sigue el patrón de responses: SIN GRANT para authenticated —
--    el empleador jamás lee respuestas individuales por la API; el reporte agrega
--    en servidor.
-- ─────────────────────────────────────────────────────────────────────────────

create table custom_questionnaires (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  familia_id uuid not null default gen_random_uuid(),
  version integer not null default 1,
  title text not null,
  status text not null default 'borrador' check (status in ('borrador', 'publicado', 'archivado')),
  definition jsonb not null default '{"secciones": []}'::jsonb,
  sha256 text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (company_id, id),
  unique (familia_id, version)
);

create table custom_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  questionnaire_id uuid not null,
  employee_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (questionnaire_id, employee_id),
  foreign key (company_id, questionnaire_id) references custom_questionnaires (company_id, id),
  foreign key (company_id, employee_id) references employees (company_id, id)
);

create table custom_answers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  assignment_id uuid not null,
  question_key text not null,
  answer text not null,
  answered_at timestamptz not null default now(),
  foreign key (company_id, assignment_id) references custom_assignments (company_id, id)
);
create index custom_answers_assignment on custom_answers (assignment_id, answered_at);

-- Publicado = inmutable. Borrador libre; publicado solo puede pasar a archivado
-- (sin tocar contenido); archivado ya no cambia. DELETE solo de borradores.
create or replace function app.custom_questionnaire_inmutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'borrador' then
      raise exception 'Un cuestionario % no puede borrarse (evidencia)', old.status;
    end if;
    return old;
  end if;
  if old.status = 'publicado' then
    if new.status = 'archivado'
       and new.definition = old.definition
       and new.title = old.title
       and new.sha256 = old.sha256
       and new.version = old.version
       and new.familia_id = old.familia_id
       and new.published_at = old.published_at then
      return new;
    end if;
    raise exception 'Un cuestionario publicado es inmutable: crea una nueva versión';
  end if;
  if old.status = 'archivado' then
    raise exception 'Un cuestionario archivado no puede modificarse';
  end if;
  return new;
end;
$$;

create trigger custom_questionnaires_inmutable
  before update or delete on custom_questionnaires
  for each row execute function app.custom_questionnaire_inmutable();

-- Las respuestas son INMUTABLES (regla inviolable 1, mismo patrón que responses).
create trigger custom_answers_inmutable
  before update or delete on custom_answers
  for each row execute function app.rechazar_modificacion();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table custom_questionnaires enable row level security;
alter table custom_assignments enable row level security;
alter table custom_answers enable row level security;

create policy custom_questionnaires_select on custom_questionnaires for select
  using (app.gestiona_tenant(company_id));
create policy custom_questionnaires_insert on custom_questionnaires for insert
  with check (app.gestiona_tenant(company_id));
create policy custom_questionnaires_update on custom_questionnaires for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));
create policy custom_questionnaires_delete on custom_questionnaires for delete
  using (app.gestiona_tenant(company_id));

-- Asignaciones: gestión las ve (token hasheado) — el envío/rotación de tokens y el
-- completed_at los escribe la app (service_role), como en el flujo oficial.
create policy custom_assignments_select on custom_assignments for select
  using (app.gestiona_tenant(company_id));

-- custom_answers: SIN políticas — nadie las alcanza como authenticated/anon.

grant select, insert, update, delete on custom_questionnaires to authenticated;
grant select on custom_assignments to authenticated;
-- custom_answers: SIN grants para authenticated (solo la app con service_role).
grant all on custom_questionnaires, custom_assignments, custom_answers to service_role;
