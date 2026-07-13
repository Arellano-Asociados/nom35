-- ─────────────────────────────────────────────────────────────────────────────
-- Corrección normativa GR-II: los ítems 18 y 19 SÍ integran la categoría
-- "Factores propios de la actividad".
--
-- El seed 20260711200004 los dejó con category NULL atribuyendo la exclusión al
-- DOF, pero la Tabla 3 del DOF 23-oct-2018 los incluye: pertenecen a la dimensión
-- "Limitada o nula posibilidad de desarrollo", del dominio "Falta de control sobre
-- el trabajo", que integra la categoría "Factores propios de la actividad". El
-- numeral II.3 b) 2) define la calificación de la categoría como la suma de los
-- ítems que la integran, sin exclusiones.
--
-- item_structure es una tabla de catálogo normativo (no de respuestas ni de
-- resultados), por lo que este UPDATE es legítimo. Idempotente: re-ejecutarla no
-- cambia nada una vez aplicada.
--
-- Impacto: los risk_results de centros GR-II calculados con el motor 0.1.0
-- subcalifican esta categoría; el recálculo (filas nuevas con supersedes_id,
-- motor 0.2.0) es una tarea aparte.
-- ─────────────────────────────────────────────────────────────────────────────

update item_structure ist
set category = 'Factores propios de la actividad'
from questionnaires q
where q.id = ist.questionnaire_id
  and q.code = 'GR-II'
  and ist.item_number in (18, 19)
  and ist.category is distinct from 'Factores propios de la actividad';

-- Corrige la documentación de la columna (el comentario del esquema original
-- afirmaba la exclusión de 18 y 19; era un error de transcripción, no del DOF).
comment on column item_structure.category is
  'Categoría que integra el ítem (Tabla 3 del DOF): la calificación de la categoría es la suma de todos sus ítems, sin exclusiones.';
