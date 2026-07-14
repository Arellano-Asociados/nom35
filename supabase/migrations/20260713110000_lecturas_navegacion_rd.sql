-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2.5 (migración del panel a RLS real): el Responsable Designado navega.
--
-- El RD suele portar el rol 'miembro' + flag: sin gestión. Con el panel operando
-- como el usuario (cliente de sesión), el RD necesita LEER la estructura no
-- sensible para llegar a sus vistas exclusivas (canalizaciones y resultados
-- individuales, que siguen siendo service_role auditado): la lista de ciclos y
-- los nombres de los centros. Solo SELECT; ninguna escritura de gestión.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists work_centers_select on work_centers;
create policy work_centers_select on work_centers for select
  using (app.gestiona_tenant(company_id) or app.es_responsable_designado(company_id));

drop policy if exists compliance_cycles_select on compliance_cycles;
create policy compliance_cycles_select on compliance_cycles for select
  using (app.gestiona_tenant(company_id) or app.es_responsable_designado(company_id));
