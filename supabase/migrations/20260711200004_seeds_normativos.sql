-- Seeds de datos normativos (fuente: NOM-035-STPS-2018, DOF 23-oct-2018).
-- Idempotentes (ON CONFLICT DO NOTHING). El texto oficial de los ítems se carga por seed
-- posterior: aquí van placeholders ITEM_TEXT_PENDIENTE_i con la estructura correcta.
-- Estos valores DEBEN coincidir con packages/motor-nom035/src/datos/ (misma fuente).

-- ─────────────────────────────────────────────────────────────────────────────
-- Cuestionarios
-- ─────────────────────────────────────────────────────────────────────────────

insert into questionnaires (code, name, total_items) values
  ('GR-I', 'Identificación de trabajadores sujetos a acontecimientos traumáticos severos', 20),
  ('GR-II', 'Identificación y análisis de factores de riesgo psicosocial (16 a 50 trabajadores)', 46),
  ('GR-III', 'Identificación y análisis de factores de riesgo psicosocial y evaluación del entorno organizacional (más de 50 trabajadores)', 72)
on conflict (code) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Preguntas (placeholders)
-- ─────────────────────────────────────────────────────────────────────────────

-- GR-II y GR-III: numeración corrida sin sección
insert into questions (questionnaire_id, section, item_number, text)
select q.id, null, i, 'ITEM_TEXT_PENDIENTE_' || i
from questionnaires q, generate_series(1, q.total_items) as i
where q.code in ('GR-II', 'GR-III')
on conflict do nothing;

-- GR-I: numeración por sección.
-- CONFIRMADO (2026-07-12): el conteo por sección (I=6, II=2, III=7, IV=5) coincide con el
-- texto oficial del DOF 23-oct-2018 y con el PDF de la STPS (ver migración
-- 20260713010000_textos_oficiales_items.sql y scripts/textos-oficiales.json).
insert into questions (questionnaire_id, section, item_number, text)
select q.id, s.seccion, i, 'ITEM_TEXT_PENDIENTE_GR1_' || s.seccion || '_' || i
from questionnaires q,
  (values ('I', 6), ('II', 2), ('III', 7), ('IV', 5)) as s (seccion, total),
  lateral generate_series(1, s.total) as i
where q.code = 'GR-I'
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- scoring_rules: grupo A directo, grupo B inverso (solo GR-II y GR-III)
-- ─────────────────────────────────────────────────────────────────────────────

insert into scoring_rules (questionnaire_id, scoring_group, option_value, score)
select q.id, g.grupo, o.opcion, case when g.grupo = 'A' then o.directo else 4 - o.directo end
from questionnaires q,
  (values ('A'), ('B')) as g (grupo),
  (values
    ('siempre', 0),
    ('casi_siempre', 1),
    ('algunas_veces', 2),
    ('casi_nunca', 3),
    ('nunca', 4)
  ) as o (opcion, directo)
where q.code in ('GR-II', 'GR-III')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- item_structure GR-III (72 ítems)
-- ─────────────────────────────────────────────────────────────────────────────

insert into item_structure (questionnaire_id, item_number, scoring_group, domain, category, conditional)
select
  q.id,
  i,
  case when i in (1, 4, 23, 24, 25, 26, 27, 28, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
                  41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 55, 56, 57)
    then 'A' else 'B' end,
  case
    when i between 1 and 5 then 'Condiciones en el ambiente de trabajo'
    when i between 6 and 16 or i between 65 and 68 then 'Carga de trabajo'
    when i between 23 and 30 or i in (35, 36) then 'Falta de control sobre el trabajo'
    when i in (17, 18) then 'Jornada de trabajo'
    when i between 19 and 22 then 'Interferencia en la relación trabajo-familia'
    when i between 31 and 34 or i between 37 and 41 then 'Liderazgo'
    when i between 42 and 46 or i between 69 and 72 then 'Relaciones en el trabajo'
    when i between 57 and 64 then 'Violencia'
    when i between 47 and 52 then 'Reconocimiento del desempeño'
    else 'Insuficiente sentido de pertenencia e inestabilidad'
  end,
  case
    when i between 1 and 5 then 'Ambiente de trabajo'
    when i between 6 and 16 or i between 65 and 68
      or i between 23 and 30 or i in (35, 36) then 'Factores propios de la actividad'
    when i between 17 and 22 then 'Organización del tiempo de trabajo'
    when i between 31 and 34 or i between 37 and 46
      or i between 69 and 72 or i between 57 and 64 then 'Liderazgo y relaciones en el trabajo'
    else 'Entorno organizacional'
  end,
  case
    when i between 65 and 68 then 'atiende_clientes'
    when i between 69 and 72 then 'supervisa_personal'
  end
from questionnaires q, generate_series(1, 72) as i
where q.code = 'GR-III'
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- item_structure GR-II (46 ítems). Los ítems 18 y 19 pertenecen al dominio
-- "Falta de control sobre el trabajo" pero NO puntúan en ninguna categoría (DOF).
-- ─────────────────────────────────────────────────────────────────────────────

insert into item_structure (questionnaire_id, item_number, scoring_group, domain, category, conditional)
select
  q.id,
  i,
  case when i between 18 and 33 then 'A' else 'B' end,
  case
    when i between 1 and 3 then 'Condiciones en el ambiente de trabajo'
    when i between 4 and 13 or i between 41 and 43 then 'Carga de trabajo'
    when i between 18 and 22 or i in (26, 27) then 'Falta de control sobre el trabajo'
    when i in (14, 15) then 'Jornada de trabajo'
    when i in (16, 17) then 'Interferencia en la relación trabajo-familia'
    when i between 23 and 25 or i in (28, 29) then 'Liderazgo'
    when i between 30 and 32 or i between 44 and 46 then 'Relaciones en el trabajo'
    else 'Violencia'
  end,
  case
    when i between 1 and 3 then 'Ambiente de trabajo'
    when i between 4 and 13 or i between 20 and 22
      or i in (26, 27) or i between 41 and 43 then 'Factores propios de la actividad'
    when i between 14 and 17 then 'Organización del tiempo de trabajo'
    when i between 23 and 25 or i between 28 and 40
      or i between 44 and 46 then 'Liderazgo y relaciones en el trabajo'
    -- ítems 18 y 19: sin categoría
  end,
  case
    when i between 41 and 43 then 'atiende_clientes'
    when i between 44 and 46 then 'supervisa_personal'
  end
from questionnaires q, generate_series(1, 46) as i
where q.code = 'GR-II'
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- risk_level_ranges
-- ─────────────────────────────────────────────────────────────────────────────

-- GR-III
insert into risk_level_ranges (questionnaire_id, scope, scope_name, nulo_max, bajo_max, medio_max, alto_max)
select q.id, r.scope, r.scope_name, r.nulo, r.bajo, r.medio, r.alto
from questionnaires q,
  (values
    ('cfinal', null, 50, 75, 99, 140),
    ('categoria', 'Ambiente de trabajo', 5, 9, 11, 14),
    ('categoria', 'Factores propios de la actividad', 15, 30, 45, 60),
    ('categoria', 'Organización del tiempo de trabajo', 5, 7, 10, 13),
    ('categoria', 'Liderazgo y relaciones en el trabajo', 14, 29, 42, 58),
    ('categoria', 'Entorno organizacional', 10, 14, 18, 23),
    ('dominio', 'Condiciones en el ambiente de trabajo', 5, 9, 11, 14),
    ('dominio', 'Carga de trabajo', 15, 21, 27, 37),
    ('dominio', 'Falta de control sobre el trabajo', 11, 16, 21, 25),
    ('dominio', 'Jornada de trabajo', 1, 2, 4, 6),
    ('dominio', 'Interferencia en la relación trabajo-familia', 4, 6, 8, 10),
    ('dominio', 'Liderazgo', 9, 12, 16, 20),
    ('dominio', 'Relaciones en el trabajo', 10, 13, 17, 21),
    ('dominio', 'Violencia', 7, 10, 13, 16),
    ('dominio', 'Reconocimiento del desempeño', 6, 10, 14, 18),
    ('dominio', 'Insuficiente sentido de pertenencia e inestabilidad', 4, 6, 8, 10)
  ) as r (scope, scope_name, nulo, bajo, medio, alto)
where q.code = 'GR-III'
on conflict do nothing;

-- GR-II
insert into risk_level_ranges (questionnaire_id, scope, scope_name, nulo_max, bajo_max, medio_max, alto_max)
select q.id, r.scope, r.scope_name, r.nulo, r.bajo, r.medio, r.alto
from questionnaires q,
  (values
    ('cfinal', null, 20, 45, 70, 90),
    ('categoria', 'Ambiente de trabajo', 3, 5, 7, 9),
    ('categoria', 'Factores propios de la actividad', 10, 20, 30, 40),
    ('categoria', 'Organización del tiempo de trabajo', 4, 6, 9, 12),
    ('categoria', 'Liderazgo y relaciones en el trabajo', 10, 18, 28, 38),
    ('dominio', 'Condiciones en el ambiente de trabajo', 3, 5, 7, 9),
    ('dominio', 'Carga de trabajo', 12, 16, 20, 24),
    ('dominio', 'Falta de control sobre el trabajo', 5, 8, 11, 14),
    ('dominio', 'Jornada de trabajo', 1, 2, 4, 6),
    ('dominio', 'Interferencia en la relación trabajo-familia', 1, 2, 4, 6),
    ('dominio', 'Liderazgo', 3, 5, 8, 11),
    ('dominio', 'Relaciones en el trabajo', 5, 8, 11, 14),
    ('dominio', 'Violencia', 7, 10, 13, 16)
  ) as r (scope, scope_name, nulo, bajo, medio, alto)
where q.code = 'GR-II'
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Umbrales GR-I (sin puntaje: mínimos de respuestas "Sí" por sección)
-- ─────────────────────────────────────────────────────────────────────────────

insert into system_config (key, value) values
  ('gr1_reglas', '{"min_si_seccion_ii": 1, "min_si_seccion_iii": 3, "min_si_seccion_iv": 2}')
on conflict (key) do nothing;
