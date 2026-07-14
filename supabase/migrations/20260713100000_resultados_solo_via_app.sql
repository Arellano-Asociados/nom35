-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2.5: los resultados individuales SOLO se alcanzan a través de la app.
--
-- Hallazgo (docs/AUDITORIA.md, plan de migración fuera de service_role): el
-- Responsable Designado tenía GRANT de SELECT sobre risk_results y gr1_results
-- como `authenticated`, con política "solo RD o el propio empleado". Eso permitía
-- a un RD con su JWT leer resultados individuales DIRECTO por la API REST de
-- Supabase, esquivando la auditoría fail-closed de la app (regla inviolable 5:
-- cada consulta genera `individual_result_access`; sin evento no hay consulta).
--
-- Además, las políticas del "propio empleado" (app.es_empleado) eran inalcanzables
-- en la práctica: el flujo del empleado corre por token con service_role y
-- employees.auth_user_id nunca se escribe (anexo de la auditoría v0).
--
-- Remedio: mismo patrón que protege responses — sin GRANT para authenticated.
-- El único camino a un resultado individual es la app (service_role), que audita
-- (RD, fail-closed) o registra la consulta del titular. La agregación del
-- dashboard/informe también es service_role y solo publica distribuciones.
-- ─────────────────────────────────────────────────────────────────────────────

revoke select on risk_results from authenticated;
revoke select, update on gr1_results from authenticated;

drop policy if exists risk_results_select on risk_results;
drop policy if exists gr1_results_select on gr1_results;
drop policy if exists gr1_results_update on gr1_results;

comment on table risk_results is
  'Resultados procesados (INMUTABLES, regla 1). Sin GRANT para authenticated: solo la app (service_role) los lee, con auditoría por consulta (regla 5).';
comment on table gr1_results is
  'Resultados GR-I y canalización (regla 5). Sin GRANT para authenticated: lectura y actualización solo por la app (service_role) con auditoría.';
