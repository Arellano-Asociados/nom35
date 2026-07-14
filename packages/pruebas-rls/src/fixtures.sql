-- Fixtures de los tests de aislamiento multi-tenant. Idempotentes (UUIDs fijos + ON CONFLICT).
-- Dos tenants completos (A y B) con una fila en cada tabla de tenant.
--
-- Usuarios (auth uid):
--   11111111-0000-4000-8000-000000000001  admin_org de A
--   11111111-0000-4000-8000-000000000002  Responsable Designado de A (rol miembro + flag)
--   11111111-0000-4000-8000-000000000003  consultor asignado a A
--   11111111-0000-4000-8000-000000000004  empleado A1 (con cuenta)
--   22222222-0000-4000-8000-000000000001  admin_org de B
--   22222222-0000-4000-8000-000000000002  empleado B1 (con cuenta)
--   33333333-0000-4000-8000-000000000001  consultor sin asignaciones

insert into companies (id, legal_name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Tenant A, S.A. de C.V.'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Tenant B, S.A. de C.V.')
on conflict do nothing;

insert into work_centers (id, company_id, name, headcount) values
  ('aaaaaaaa-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000001', 'Centro A1', 180),
  ('aaaaaaaa-0000-4000-8000-000000000012', 'aaaaaaaa-0000-4000-8000-000000000001', 'Centro A2 sin ciclo', 60),
  ('bbbbbbbb-0000-4000-8000-000000000011', 'bbbbbbbb-0000-4000-8000-000000000001', 'Centro B1', 30)
on conflict do nothing;

insert into employees (id, company_id, work_center_id, auth_user_id, full_name, email) values
  ('aaaaaaaa-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000011', '11111111-0000-4000-8000-000000000004',
   'Empleada A1', 'a1@tenant-a.mx'),
  ('aaaaaaaa-0000-4000-8000-000000000022', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000011', null, 'Empleado A2', 'a2@tenant-a.mx'),
  ('bbbbbbbb-0000-4000-8000-000000000021', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-000000000011', '22222222-0000-4000-8000-000000000002',
   'Empleado B1', 'b1@tenant-b.mx')
on conflict do nothing;

insert into role_assignments (id, company_id, auth_user_id, role, is_designated_responsible) values
  ('aaaaaaaa-0000-4000-8000-000000000031', 'aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-0000-4000-8000-000000000001', 'admin_org', false),
  ('aaaaaaaa-0000-4000-8000-000000000032', 'aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-0000-4000-8000-000000000002', 'miembro', true),
  ('bbbbbbbb-0000-4000-8000-000000000031', 'bbbbbbbb-0000-4000-8000-000000000001',
   '22222222-0000-4000-8000-000000000001', 'admin_org', false)
on conflict do nothing;

insert into consultant_assignments (id, company_id, consultant_user_id) values
  ('aaaaaaaa-0000-4000-8000-000000000041', 'aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-0000-4000-8000-000000000003')
on conflict do nothing;

insert into compliance_cycles
  (id, company_id, work_center_id, name, date_start, date_end, evaluator_name, evaluator_license) values
  ('aaaaaaaa-0000-4000-8000-000000000051', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000011', 'Ciclo A 2026', '2026-01-15', '2026-02-28',
   'Eval A', 'CED-A-1'),
  ('bbbbbbbb-0000-4000-8000-000000000051', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-000000000011', 'Ciclo B 2023', '2023-01-15', '2023-02-28',
   'Eval B', 'CED-B-1')
on conflict do nothing;

insert into questionnaire_assignments
  (id, company_id, cycle_id, employee_id, questionnaire_id, token_hash, expires_at) values
  ('aaaaaaaa-0000-4000-8000-000000000061', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000051', 'aaaaaaaa-0000-4000-8000-000000000021',
   (select id from questionnaires where code = 'GR-III'), 'hash-a1', now() + interval '30 days'),
  ('aaaaaaaa-0000-4000-8000-000000000062', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000051', 'aaaaaaaa-0000-4000-8000-000000000022',
   (select id from questionnaires where code = 'GR-III'), 'hash-a2', now() + interval '30 days'),
  ('bbbbbbbb-0000-4000-8000-000000000061', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-000000000051', 'bbbbbbbb-0000-4000-8000-000000000021',
   (select id from questionnaires where code = 'GR-II'), 'hash-b1', now() + interval '30 days')
on conflict do nothing;

insert into consents (id, company_id, assignment_id, employee_id, privacy_text_version, ip) values
  ('aaaaaaaa-0000-4000-8000-000000000071', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000061', 'aaaaaaaa-0000-4000-8000-000000000021', 'v1', '10.0.0.1'),
  ('bbbbbbbb-0000-4000-8000-000000000071', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-000000000061', 'bbbbbbbb-0000-4000-8000-000000000021', 'v1', '10.0.0.2')
on conflict do nothing;

insert into responses (id, company_id, assignment_id, item_number, answer) values
  ('aaaaaaaa-0000-4000-8000-000000000081', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000061', 1, 'algunas_veces'),
  ('bbbbbbbb-0000-4000-8000-000000000081', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-000000000061', 1, 'nunca')
on conflict do nothing;

-- engine_version deliberadamente sintética: estas filas prueban AISLAMIENTO, no cálculo.
-- No usar una versión real del motor: al auditar residuos de un motor viejo (p. ej. el
-- recálculo GR-II de la Fase 1.5) estas filas aparecerían como falsos positivos.
insert into risk_results
  (id, company_id, assignment_id, employee_id, cycle_id, questionnaire_id,
   cfinal, nivel_final, categorias, dominios, engine_version) values
  ('aaaaaaaa-0000-4000-8000-000000000091', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000061', 'aaaaaaaa-0000-4000-8000-000000000021',
   'aaaaaaaa-0000-4000-8000-000000000051',
   (select id from questionnaires where code = 'GR-III'), 42, 'nulo', '[]', '[]', '0.0.0-fixture-rls'),
  ('bbbbbbbb-0000-4000-8000-000000000091', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-000000000061', 'bbbbbbbb-0000-4000-8000-000000000021',
   'bbbbbbbb-0000-4000-8000-000000000051',
   (select id from questionnaires where code = 'GR-II'), 25, 'bajo', '[]', '[]', '0.0.0-fixture-rls')
on conflict do nothing;

insert into gr1_results
  (id, company_id, assignment_id, employee_id, cycle_id,
   presento_acontecimiento, requiere_valoracion, secciones_disparadas) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000061', 'aaaaaaaa-0000-4000-8000-000000000021',
   'aaaaaaaa-0000-4000-8000-000000000051', true, true, '{IV}'),
  ('bbbbbbbb-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-000000000061', 'bbbbbbbb-0000-4000-8000-000000000021',
   'bbbbbbbb-0000-4000-8000-000000000051', false, false, '{}')
on conflict do nothing;

insert into action_items (id, company_id, cycle_id, description, origin_level, responsible) values
  ('aaaaaaaa-0000-4000-8000-0000000000b1', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000051', 'Acción A', 'medio', 'RH A'),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-000000000051', 'Acción B', 'alto', 'RH B')
on conflict do nothing;

insert into policies (id, company_id, title, version, storage_path) values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Política A', 'v1', 'a/politica.pdf'),
  ('bbbbbbbb-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-000000000001',
   'Política B', 'v1', 'b/politica.pdf')
on conflict do nothing;

insert into policy_acknowledgments (id, company_id, policy_id, employee_id) values
  ('aaaaaaaa-0000-4000-8000-0000000000d1', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-000000000021'),
  ('bbbbbbbb-0000-4000-8000-0000000000d1', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-000000000021')
on conflict do nothing;

insert into training_contents (id, company_id, title, storage_path) values
  ('aaaaaaaa-0000-4000-8000-0000000000e1', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Curso A', 'a/curso.mp4'),
  ('bbbbbbbb-0000-4000-8000-0000000000e1', 'bbbbbbbb-0000-4000-8000-000000000001',
   'Curso B', 'b/curso.mp4')
on conflict do nothing;

insert into training_records (id, company_id, training_id, employee_id) values
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-0000000000e1', 'aaaaaaaa-0000-4000-8000-000000000021'),
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-0000000000e1', 'bbbbbbbb-0000-4000-8000-000000000021')
on conflict do nothing;

insert into compliance_reports (id, company_id, cycle_id, report_type, storage_path, sha256) values
  ('aaaaaaaa-0000-4000-8000-000000000101', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000051', 'informe_79', 'a/informe.pdf', 'deadbeef'),
  ('bbbbbbbb-0000-4000-8000-000000000101', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-000000000051', 'informe_79', 'b/informe.pdf', 'cafebabe')
on conflict do nothing;

insert into audit_log (id, company_id, actor_user_id, event_type, entity) values
  ('aaaaaaaa-0000-4000-8000-000000000111', 'aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-0000-4000-8000-000000000001', 'fixture', 'test'),
  ('bbbbbbbb-0000-4000-8000-000000000111', 'bbbbbbbb-0000-4000-8000-000000000001',
   '22222222-0000-4000-8000-000000000001', 'fixture', 'test')
on conflict do nothing;

-- Feature flags (Fase 3): uno por tenant para probar lectura propia y aislamiento.
insert into feature_flags (company_id, flag, enabled) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'demo_flag', true),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'demo_flag', false)
on conflict do nothing;
