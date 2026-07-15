-- Fase 5: métricas cross-tenant SOLO OPERATIVAS (spec §5). La frontera se expresa UNA
-- vez, en estas vistas: el código de la app no puede "driftear" hacia columnas
-- prohibidas porque la vista no las tiene.
--
-- PERMITIDO (exhaustivo): companies (id, legal_name, rfc, status, created_at) ·
-- work_centers (conteo) · employees (CONTEO únicamente) · compliance_cycles (id,
-- fechas, marca ATS) · questionnaire_assignments (conteos por estado — jamás token_hash
-- ni employee_id).
--
-- PROHIBIDO (la frontera, regla inviolable 4 aplicada al operador): responses ·
-- risk_results · gr1_results · registros 5.8 · buzón de quejas (NI conteos) ·
-- contenido de informes/expedientes/difusiones · CUALQUIER agregado derivado de salud,
-- aunque tenga supresión n<3.

create view plataforma_metricas_organizaciones as
  select c.id, c.legal_name, c.rfc, c.status, c.created_at,
         (select count(*) from work_centers w where w.company_id = c.id) as centros,
         (select count(*) from employees e where e.company_id = c.id and e.active) as empleados
  from companies c;

create view plataforma_metricas_ciclos as
  select cc.id, cc.company_id, cc.date_start, cc.date_end,
         (cc.traumatic_event_id is not null) as es_evento_ats,
         count(qa.*) as asignaciones,
         count(qa.*) filter (where qa.completed_at is not null) as completadas
  from compliance_cycles cc
  left join questionnaire_assignments qa on qa.cycle_id = cc.id
  group by cc.id;

comment on view plataforma_metricas_organizaciones is
  'Métricas operativas de plataforma. GRANT exclusivo a service_role: ninguna sesión (tenant u operador) las lee directo.';
comment on view plataforma_metricas_ciclos is
  'Participación por ciclo (conteos). La tasa de respuesta es conducta operativa, no dato de salud; se muestra por empresa/ciclo o global, nunca por centro pequeño.';

revoke all on plataforma_metricas_organizaciones, plataforma_metricas_ciclos
  from public, anon, authenticated;
grant select on plataforma_metricas_organizaciones, plataforma_metricas_ciclos to service_role;
