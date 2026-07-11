-- Flujo del empleado (Milestone 3).
--
-- 1) Las preguntas filtro (atiende clientes / supervisa personal) se capturan por assignment;
--    queda constancia del momento.
alter table questionnaire_assignments
  add column filters_captured_at timestamptz;

-- 2) El empleado puede CORREGIR una respuesta antes de enviar el cuestionario sin romper la
--    inmutabilidad: cada corrección es una FILA NUEVA (append-only intacto, el historial es
--    evidencia). La respuesta vigente de un ítem es la de answered_at más reciente (desempate
--    por id). Se elimina la restricción de unicidad por ítem que impedía correcciones.
alter table responses
  drop constraint if exists responses_assignment_id_section_item_number_key;

create index responses_vigente_idx
  on responses (assignment_id, item_number, answered_at desc);

comment on column responses.answered_at is
  'La respuesta vigente de un ítem es la fila más reciente (answered_at, id). Las anteriores son historial inmutable.';
