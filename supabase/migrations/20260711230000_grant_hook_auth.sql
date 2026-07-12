-- ─────────────────────────────────────────────────────────────────────────────
-- El hook app.custom_access_token corre como supabase_auth_admin (GoTrue).
-- El GRANT EXECUTE sobre la función (20260711200003) no basta: sin USAGE sobre
-- el esquema app, la emisión de todo JWT administrativo falla con 500 (el
-- cliente recibe AuthApiError con cuerpo vacío "{}") en signup e inicio de
-- sesión con contraseña.
-- ─────────────────────────────────────────────────────────────────────────────

grant usage on schema app to supabase_auth_admin;
