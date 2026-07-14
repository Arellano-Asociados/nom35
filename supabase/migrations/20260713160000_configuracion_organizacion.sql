-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3: configuración de organización y plantillas de comunicación.
-- Principio de la fase: todo configurable tiene default sensato y vive en BD bajo
-- RLS (nada en código). Sin fila → defaults del código.
-- ─────────────────────────────────────────────────────────────────────────────

create table company_settings (
  company_id uuid primary key references companies (id) on delete cascade,
  logo_path text,
  timezone text not null default 'America/Mexico_City',
  contacto_nombre text,
  contacto_correo text,
  contacto_telefono text,
  updated_at timestamptz not null default now()
);

alter table company_settings enable row level security;
create policy company_settings_select on company_settings for select
  using (app.gestiona_tenant(company_id));
create policy company_settings_insert on company_settings for insert
  with check (app.gestiona_tenant(company_id));
create policy company_settings_update on company_settings for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));
grant select, insert, update on company_settings to authenticated;
grant all on company_settings to service_role;

-- Plantillas de correo: sin fila aplica la plantilla original del código; borrar la
-- fila = "restaurar plantilla original". El cuerpo es TEXTO PLANO con variables
-- {{nombre}}/{{empresa}}/{{fecha_limite}}; el escape de HTML es obligatorio y ocurre
-- SIEMPRE al renderizar (plantillaCorreo) — precedente: inyección por CSV.
create table mail_templates (
  company_id uuid not null references companies (id) on delete cascade,
  tipo text not null check (tipo in ('invitacion', 'recordatorio', 'acuse')),
  asunto text not null,
  cuerpo text not null,
  updated_at timestamptz not null default now(),
  primary key (company_id, tipo)
);

alter table mail_templates enable row level security;
create policy mail_templates_select on mail_templates for select
  using (app.gestiona_tenant(company_id));
create policy mail_templates_insert on mail_templates for insert
  with check (app.gestiona_tenant(company_id));
create policy mail_templates_update on mail_templates for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));
create policy mail_templates_delete on mail_templates for delete
  using (app.gestiona_tenant(company_id));
grant select, insert, update, delete on mail_templates to authenticated;
grant all on mail_templates to service_role;

-- Bucket privado para logos de cliente (se sirven por URL firmada / se incrustan
-- en el PDF); la escritura la hace la app (service_role) tras validar magic bytes.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', false)
on conflict (id) do nothing;
