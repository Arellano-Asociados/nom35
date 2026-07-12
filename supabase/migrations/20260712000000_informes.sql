-- Bucket privado de Storage para informes de expediente de inspección (Milestone 5).
-- Solo el backend (service_role) puede leer/escribir; los archivos se sirven vía signed URL.
insert into storage.buckets (id, name, public)
values ('informes', 'informes', false)
on conflict (id) do nothing;
