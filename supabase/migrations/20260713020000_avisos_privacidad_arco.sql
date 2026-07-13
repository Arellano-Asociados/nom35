-- Aviso de privacidad versionado y solicitudes ARCO (corrección de la auditoría v0).
--
-- Problema 1 (probatorio): `consents` guardaba `privacy_text_version` ('v1'), pero el
-- TEXTO del aviso vivía en un componente React y cambiaba con cada despliegue sin que la
-- etiqueta cambiara. Ante un litigio se podía acreditar QUE el trabajador aceptó "v1" el
-- día X desde la IP Y, pero NO QUÉ DECÍA "v1". El git blame de un componente no es
-- evidencia oponible: todo el valor probatorio del consentimiento se perdía.
--
-- Problema 2 (legal): no existía ningún mecanismo de derechos ARCO (arts. 22-34 LFPDPPP),
-- que obligan al responsable a atender solicitudes de Acceso, Rectificación, Cancelación
-- y Oposición en 20 días hábiles.

-- ─────────────────────────────────────────────────────────────────────────────
-- privacy_notices: el texto íntegro de cada versión, append-only y con hash.
-- El responsable de los datos es LA EMPRESA (la plataforma es encargada), así que el
-- aviso es por empresa: cada una publica el suyo y lo versiona.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists privacy_notices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  version text not null,
  -- Texto íntegro tal como se le mostró al titular. Nunca se edita.
  texto text not null,
  -- Huella del texto: permite demostrar que lo archivado es lo que se aceptó.
  sha256 text not null,
  published_at timestamptz not null default now(),
  unique (company_id, version),
  unique (company_id, id)
);

comment on table privacy_notices is
  'Texto íntegro y versionado del aviso de privacidad de cada empresa (append-only). Lo que el titular aceptó debe poder exhibirse tal cual años después.';

-- Append-only: el aviso aceptado no puede reescribirse a posteriori.
drop trigger if exists privacy_notices_inmutable on privacy_notices;
create trigger privacy_notices_inmutable
  before update or delete on privacy_notices
  for each row execute function app.rechazar_modificacion();

alter table privacy_notices enable row level security;

-- Lo gestiona la empresa; el flujo del empleado lo lee con service_role.
drop policy if exists privacy_notices_select on privacy_notices;
create policy privacy_notices_select on privacy_notices for select
  using (app.gestiona_tenant(company_id));
drop policy if exists privacy_notices_insert on privacy_notices;
create policy privacy_notices_insert on privacy_notices for insert
  with check (app.gestiona_tenant(company_id));

grant select, insert on privacy_notices to authenticated;
-- Sin default privileges en este esquema: el backend (service_role) necesita GRANT
-- explícito o el flujo del empleado no puede archivar/leer el aviso.
grant all on privacy_notices to service_role;

-- El consentimiento apunta a la fila exacta del aviso que se aceptó (no solo su etiqueta).
alter table consents add column if not exists privacy_notice_id uuid;
alter table consents drop constraint if exists consents_privacy_notice_fk;
alter table consents add constraint consents_privacy_notice_fk
  foreign key (company_id, privacy_notice_id) references privacy_notices (company_id, id);

comment on column consents.privacy_notice_id is
  'Fila exacta de privacy_notices que el titular aceptó. privacy_text_version se conserva por compatibilidad.';

-- ─────────────────────────────────────────────────────────────────────────────
-- arco_requests: solicitudes de derechos ARCO (arts. 22-34 LFPDPPP).
-- El titular puede no tener cuenta (los trabajadores no la tienen): la solicitud se
-- identifica por el correo que declara, y la empresa la atiende y deja constancia.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists arco_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  -- Acceso, Rectificación, Cancelación, Oposición (y revocación del consentimiento).
  tipo text not null check (tipo in ('acceso', 'rectificacion', 'cancelacion', 'oposicion', 'revocacion')),
  nombre_solicitante text not null,
  email_solicitante citext not null,
  descripcion text not null,
  estatus text not null default 'recibida' check (estatus in ('recibida', 'en_proceso', 'atendida', 'rechazada')),
  respuesta text,
  created_at timestamptz not null default now(),
  atendida_at timestamptz,
  unique (company_id, id)
);

comment on table arco_requests is
  'Solicitudes de derechos ARCO. La LFPDPPP (art. 32) obliga a responder en 20 días hábiles: created_at es el inicio del plazo.';

alter table arco_requests enable row level security;

-- La empresa (responsable) ve y atiende las solicitudes que recibe.
drop policy if exists arco_requests_select on arco_requests;
create policy arco_requests_select on arco_requests for select
  using (app.gestiona_tenant(company_id));
drop policy if exists arco_requests_update on arco_requests;
create policy arco_requests_update on arco_requests for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));

grant select, update on arco_requests to authenticated;
-- El alta la hace el servidor (service_role): el solicitante no tiene cuenta.
grant all on arco_requests to service_role;

create index if not exists arco_requests_pendientes_idx
  on arco_requests (company_id, estatus, created_at);
