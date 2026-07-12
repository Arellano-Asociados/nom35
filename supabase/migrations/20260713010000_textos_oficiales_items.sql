-- Textos oficiales de los ítems de las Guías de Referencia I, II y III de la
-- NOM-035-STPS-2018. Fuente primaria: DOF 23-oct-2018
-- (https://www.dof.gob.mx/nota_detalle.php?codigo=5541828&fecha=23/10/2018),
-- contrastada ítem por ítem contra el PDF oficial de la STPS
-- (https://asinom.stps.gob.mx/upload/nom/48.pdf) sin discrepancias.
-- La transcripción canónica vive en scripts/textos-oficiales.json (con sha256);
-- scripts/verificar-textos-items.mjs compara la BD contra ese archivo carácter a carácter.
--
-- Decisión de diseño (encabezados de bloque): el DOF intercala instrucciones que
-- preceden a bloques de ítems (p. ej. "Las preguntas siguientes están relacionadas
-- con la atención a clientes y usuarios."). Se guardan en la columna
-- questions.instruccion_previa del PRIMER ítem de cada bloque: es el diseño mínimo
-- que preserva la relación instrucción→ítem sin tabla nueva, y la UI la muestra
-- encima del ítem correspondiente. Si el bloque condicional no aplica (filtros del
-- empleado), la instrucción desaparece junto con sus ítems.
--
-- Idempotente: UPDATE por (questionnaire_id, section, item_number).

alter table questions add column if not exists instruccion_previa text;

comment on column questions.instruccion_previa is
  'Instrucción o encabezado de bloque del DOF que precede a este ítem (solo en el primer ítem de cada bloque). NULL si el ítem no abre bloque.';

comment on column questions.text is
  'Texto oficial del ítem (DOF 23-oct-2018, contrastado contra el PDF oficial de la STPS). La transcripción canónica y su sha256 viven en scripts/textos-oficiales.json.';

-- ─────────────────────────────────────────────────────────────────────────────
-- GR-II (46 ítems, numeración corrida)
-- ─────────────────────────────────────────────────────────────────────────────

update questions q
set text = v.texto, instruccion_previa = v.instruccion
from (values
  (1, 'Mi trabajo me exige hacer mucho esfuerzo físico', 'Para responder las preguntas siguientes considere las condiciones de su centro de trabajo, así como la cantidad y ritmo de trabajo.'),
  (2, 'Me preocupa sufrir un accidente en mi trabajo', null),
  (3, 'Considero que las actividades que realizo son peligrosas', null),
  (4, 'Por la cantidad de trabajo que tengo debo quedarme tiempo adicional a mi turno', null),
  (5, 'Por la cantidad de trabajo que tengo debo trabajar sin parar', null),
  (6, 'Considero que es necesario mantener un ritmo de trabajo acelerado', null),
  (7, 'Mi trabajo exige que esté muy concentrado', null),
  (8, 'Mi trabajo requiere que memorice mucha información', null),
  (9, 'Mi trabajo exige que atienda varios asuntos al mismo tiempo', null),
  (10, 'En mi trabajo soy responsable de cosas de mucho valor', 'Las preguntas siguientes están relacionadas con las actividades que realiza en su trabajo y las responsabilidades que tiene.'),
  (11, 'Respondo ante mi jefe por los resultados de toda mi área de trabajo', null),
  (12, 'En mi trabajo me dan órdenes contradictorias', null),
  (13, 'Considero que en mi trabajo me piden hacer cosas innecesarias', null),
  (14, 'Trabajo horas extras más de tres veces a la semana', 'Las preguntas siguientes están relacionadas con el tiempo destinado a su trabajo y sus responsabilidades familiares.'),
  (15, 'Mi trabajo me exige laborar en días de descanso, festivos o fines de semana', null),
  (16, 'Considero que el tiempo en el trabajo es mucho y perjudica mis actividades familiares o personales', null),
  (17, 'Pienso en las actividades familiares o personales cuando estoy en mi trabajo', null),
  (18, 'Mi trabajo permite que desarrolle nuevas habilidades', 'Las preguntas siguientes están relacionadas con las decisiones que puede tomar en su trabajo.'),
  (19, 'En mi trabajo puedo aspirar a un mejor puesto', null),
  (20, 'Durante mi jornada de trabajo puedo tomar pausas cuando las necesito', null),
  (21, 'Puedo decidir la velocidad a la que realizo mis actividades en mi trabajo', null),
  (22, 'Puedo cambiar el orden de las actividades que realizo en mi trabajo', null),
  (23, 'Me informan con claridad cuáles son mis funciones', 'Las preguntas siguientes están relacionadas con la capacitación e información que recibe sobre su trabajo.'),
  (24, 'Me explican claramente los resultados que debo obtener en mi trabajo', null),
  (25, 'Me informan con quién puedo resolver problemas o asuntos de trabajo', null),
  (26, 'Me permiten asistir a capacitaciones relacionadas con mi trabajo', null),
  (27, 'Recibo capacitación útil para hacer mi trabajo', null),
  (28, 'Mi jefe tiene en cuenta mis puntos de vista y opiniones', 'Las preguntas siguientes se refieren a las relaciones con sus compañeros de trabajo y su jefe.'),
  (29, 'Mi jefe ayuda a solucionar los problemas que se presentan en el trabajo', null),
  (30, 'Puedo confiar en mis compañeros de trabajo', null),
  (31, 'Cuando tenemos que realizar trabajo de equipo los compañeros colaboran', null),
  (32, 'Mis compañeros de trabajo me ayudan cuando tengo dificultades', null),
  (33, 'En mi trabajo puedo expresarme libremente sin interrupciones', null),
  (34, 'Recibo críticas constantes a mi persona y/o trabajo', null),
  (35, 'Recibo burlas, calumnias, difamaciones, humillaciones o ridiculizaciones', null),
  (36, 'Se ignora mi presencia o se me excluye de las reuniones de trabajo y en la toma de decisiones', null),
  (37, 'Se manipulan las situaciones de trabajo para hacerme parecer un mal trabajador', null),
  (38, 'Se ignoran mis éxitos laborales y se atribuyen a otros trabajadores', null),
  (39, 'Me bloquean o impiden las oportunidades que tengo para obtener ascenso o mejora en mi trabajo', null),
  (40, 'He presenciado actos de violencia en mi centro de trabajo', null),
  (41, 'Atiendo clientes o usuarios muy enojados', 'Las preguntas siguientes están relacionadas con la atención a clientes y usuarios.'),
  (42, 'Mi trabajo me exige atender personas muy necesitadas de ayuda o enfermas', null),
  (43, 'Para hacer mi trabajo debo demostrar sentimientos distintos a los míos', null),
  (44, 'Comunican tarde los asuntos de trabajo', 'Las siguientes preguntas están relacionadas con las actitudes de los trabajadores que supervisa.'),
  (45, 'Dificultan el logro de los resultados del trabajo', null),
  (46, 'Ignoran las sugerencias para mejorar su trabajo', null)
) as v (item, texto, instruccion),
  questionnaires c
where c.code = 'GR-II'
  and q.questionnaire_id = c.id
  and q.section is null
  and q.item_number = v.item;

-- ─────────────────────────────────────────────────────────────────────────────
-- GR-III (72 ítems, numeración corrida)
-- ─────────────────────────────────────────────────────────────────────────────

update questions q
set text = v.texto, instruccion_previa = v.instruccion
from (values
  (1, 'El espacio donde trabajo me permite realizar mis actividades de manera segura e higiénica', 'Para responder las preguntas siguientes considere las condiciones ambientales de su centro de trabajo.'),
  (2, 'Mi trabajo me exige hacer mucho esfuerzo físico', null),
  (3, 'Me preocupa sufrir un accidente en mi trabajo', null),
  (4, 'Considero que en mi trabajo se aplican las normas de seguridad y salud en el trabajo', null),
  (5, 'Considero que las actividades que realizo son peligrosas', null),
  (6, 'Por la cantidad de trabajo que tengo debo quedarme tiempo adicional a mi turno', 'Para responder a las preguntas siguientes piense en la cantidad y ritmo de trabajo que tiene.'),
  (7, 'Por la cantidad de trabajo que tengo debo trabajar sin parar', null),
  (8, 'Considero que es necesario mantener un ritmo de trabajo acelerado', null),
  (9, 'Mi trabajo exige que esté muy concentrado', 'Las preguntas siguientes están relacionadas con el esfuerzo mental que le exige su trabajo.'),
  (10, 'Mi trabajo requiere que memorice mucha información', null),
  (11, 'En mi trabajo tengo que tomar decisiones difíciles muy rápido', null),
  (12, 'Mi trabajo exige que atienda varios asuntos al mismo tiempo', null),
  (13, 'En mi trabajo soy responsable de cosas de mucho valor', 'Las preguntas siguientes están relacionadas con las actividades que realiza en su trabajo y las responsabilidades que tiene.'),
  (14, 'Respondo ante mi jefe por los resultados de toda mi área de trabajo', null),
  (15, 'En el trabajo me dan órdenes contradictorias', null),
  (16, 'Considero que en mi trabajo me piden hacer cosas innecesarias', null),
  (17, 'Trabajo horas extras más de tres veces a la semana', 'Las preguntas siguientes están relacionadas con su jornada de trabajo.'),
  (18, 'Mi trabajo me exige laborar en días de descanso, festivos o fines de semana', null),
  (19, 'Considero que el tiempo en el trabajo es mucho y perjudica mis actividades familiares o personales', null),
  (20, 'Debo atender asuntos de trabajo cuando estoy en casa', null),
  (21, 'Pienso en las actividades familiares o personales cuando estoy en mi trabajo', null),
  (22, 'Pienso que mis responsabilidades familiares afectan mi trabajo', null),
  (23, 'Mi trabajo permite que desarrolle nuevas habilidades', 'Las preguntas siguientes están relacionadas con las decisiones que puede tomar en su trabajo.'),
  (24, 'En mi trabajo puedo aspirar a un mejor puesto', null),
  (25, 'Durante mi jornada de trabajo puedo tomar pausas cuando las necesito', null),
  (26, 'Puedo decidir cuánto trabajo realizo durante la jornada laboral', null),
  (27, 'Puedo decidir la velocidad a la que realizo mis actividades en mi trabajo', null),
  (28, 'Puedo cambiar el orden de las actividades que realizo en mi trabajo', null),
  (29, 'Los cambios que se presentan en mi trabajo dificultan mi labor', 'Las preguntas siguientes están relacionadas con cualquier tipo de cambio que ocurra en su trabajo (considere los últimos cambios realizados).'),
  (30, 'Cuando se presentan cambios en mi trabajo se tienen en cuenta mis ideas o aportaciones', null),
  (31, 'Me informan con claridad cuáles son mis funciones', 'Las preguntas siguientes están relacionadas con la capacitación e información que se le proporciona sobre su trabajo.'),
  (32, 'Me explican claramente los resultados que debo obtener en mi trabajo', null),
  (33, 'Me explican claramente los objetivos de mi trabajo', null),
  (34, 'Me informan con quién puedo resolver problemas o asuntos de trabajo', null),
  (35, 'Me permiten asistir a capacitaciones relacionadas con mi trabajo', null),
  (36, 'Recibo capacitación útil para hacer mi trabajo', null),
  (37, 'Mi jefe ayuda a organizar mejor el trabajo', 'Las preguntas siguientes están relacionadas con el o los jefes con quien tiene contacto.'),
  (38, 'Mi jefe tiene en cuenta mis puntos de vista y opiniones', null),
  (39, 'Mi jefe me comunica a tiempo la información relacionada con el trabajo', null),
  (40, 'La orientación que me da mi jefe me ayuda a realizar mejor mi trabajo', null),
  (41, 'Mi jefe ayuda a solucionar los problemas que se presentan en el trabajo', null),
  (42, 'Puedo confiar en mis compañeros de trabajo', 'Las preguntas siguientes se refieren a las relaciones con sus compañeros.'),
  (43, 'Entre compañeros solucionamos los problemas de trabajo de forma respetuosa', null),
  (44, 'En mi trabajo me hacen sentir parte del grupo', null),
  (45, 'Cuando tenemos que realizar trabajo de equipo los compañeros colaboran', null),
  (46, 'Mis compañeros de trabajo me ayudan cuando tengo dificultades', null),
  (47, 'Me informan sobre lo que hago bien en mi trabajo', 'Las preguntas siguientes están relacionadas con la información que recibe sobre su rendimiento en el trabajo, el reconocimiento, el sentido de pertenencia y la estabilidad que le ofrece su trabajo.'),
  (48, 'La forma como evalúan mi trabajo en mi centro de trabajo me ayuda a mejorar mi desempeño', null),
  (49, 'En mi centro de trabajo me pagan a tiempo mi salario', null),
  (50, 'El pago que recibo es el que merezco por el trabajo que realizo', null),
  (51, 'Si obtengo los resultados esperados en mi trabajo me recompensan o reconocen', null),
  (52, 'Las personas que hacen bien el trabajo pueden crecer laboralmente', null),
  (53, 'Considero que mi trabajo es estable', null),
  (54, 'En mi trabajo existe continua rotación de personal', null),
  (55, 'Siento orgullo de laborar en este centro de trabajo', null),
  (56, 'Me siento comprometido con mi trabajo', null),
  (57, 'En mi trabajo puedo expresarme libremente sin interrupciones', 'Las preguntas siguientes están relacionadas con actos de violencia laboral (malos tratos, acoso, hostigamiento, acoso psicológico).'),
  (58, 'Recibo críticas constantes a mi persona y/o trabajo', null),
  (59, 'Recibo burlas, calumnias, difamaciones, humillaciones o ridiculizaciones', null),
  (60, 'Se ignora mi presencia o se me excluye de las reuniones de trabajo y en la toma de decisiones', null),
  (61, 'Se manipulan las situaciones de trabajo para hacerme parecer un mal trabajador', null),
  (62, 'Se ignoran mis éxitos laborales y se atribuyen a otros trabajadores', null),
  (63, 'Me bloquean o impiden las oportunidades que tengo para obtener ascenso o mejora en mi trabajo', null),
  (64, 'He presenciado actos de violencia en mi centro de trabajo', null),
  (65, 'Atiendo clientes o usuarios muy enojados', 'Las preguntas siguientes están relacionadas con la atención a clientes y usuarios.'),
  (66, 'Mi trabajo me exige atender personas muy necesitadas de ayuda o enfermas', null),
  (67, 'Para hacer mi trabajo debo demostrar sentimientos distintos a los míos', null),
  (68, 'Mi trabajo me exige atender situaciones de violencia', null),
  (69, 'Comunican tarde los asuntos de trabajo', 'Las preguntas siguientes están relacionadas con las actitudes de las personas que supervisa.'),
  (70, 'Dificultan el logro de los resultados del trabajo', null),
  (71, 'Cooperan poco cuando se necesita', null),
  (72, 'Ignoran las sugerencias para mejorar su trabajo', null)
) as v (item, texto, instruccion),
  questionnaires c
where c.code = 'GR-III'
  and q.questionnaire_id = c.id
  and q.section is null
  and q.item_number = v.item;

-- ─────────────────────────────────────────────────────────────────────────────
-- GR-I (20 ítems por sección: I=6, II=2, III=7, IV=5 — conteo CONFIRMADO contra el DOF).
-- Los ítems de la Sección I son fragmentos que completan la pregunta introductoria
-- "¿Ha presenciado o sufrido alguna vez..."; esa introducción va en instruccion_previa
-- del primer ítem. El ítem I.5 es literalmente "Amenazas?, o" (incluye la conjunción
-- de la enumeración tal como aparece en el DOF y en el PDF de la STPS).
-- ─────────────────────────────────────────────────────────────────────────────

update questions q
set text = v.texto, instruccion_previa = v.instruccion
from (values
  ('I', 1, 'Accidente que tenga como consecuencia la muerte, la pérdida de un miembro o una lesión grave?', '¿Ha presenciado o sufrido alguna vez, durante o con motivo del trabajo un acontecimiento como los siguientes:'),
  ('I', 2, 'Asaltos?', null),
  ('I', 3, 'Actos violentos que derivaron en lesiones graves?', null),
  ('I', 4, 'Secuestro?', null),
  ('I', 5, 'Amenazas?, o', null),
  ('I', 6, 'Cualquier otro que ponga en riesgo su vida o salud, y/o la de otras personas?', null),
  ('II', 1, '¿Ha tenido recuerdos recurrentes sobre el acontecimiento que le provocan malestares?', null),
  ('II', 2, '¿Ha tenido sueños de carácter recurrente sobre el acontecimiento, que le producen malestar?', null),
  ('III', 1, '¿Se ha esforzado por evitar todo tipo de sentimientos, conversaciones o situaciones que le puedan recordar el acontecimiento?', null),
  ('III', 2, '¿Se ha esforzado por evitar todo tipo de actividades, lugares o personas que motivan recuerdos del acontecimiento?', null),
  ('III', 3, '¿Ha tenido dificultad para recordar alguna parte importante del evento?', null),
  ('III', 4, '¿Ha disminuido su interés en sus actividades cotidianas?', null),
  ('III', 5, '¿Se ha sentido usted alejado o distante de los demás?', null),
  ('III', 6, '¿Ha notado que tiene dificultad para expresar sus sentimientos?', null),
  ('III', 7, '¿Ha tenido la impresión de que su vida se va a acortar, que va a morir antes que otras personas o que tiene un futuro limitado?', null),
  ('IV', 1, '¿Ha tenido usted dificultades para dormir?', null),
  ('IV', 2, '¿Ha estado particularmente irritable o le han dado arranques de coraje?', null),
  ('IV', 3, '¿Ha tenido dificultad para concentrarse?', null),
  ('IV', 4, '¿Ha estado nervioso o constantemente en alerta?', null),
  ('IV', 5, '¿Se ha sobresaltado fácilmente por cualquier cosa?', null)
) as v (seccion, item, texto, instruccion),
  questionnaires c
where c.code = 'GR-I'
  and q.questionnaire_id = c.id
  and q.section = v.seccion
  and q.item_number = v.item;

-- ─────────────────────────────────────────────────────────────────────────────
-- Guardia: tras esta migración no puede quedar ningún placeholder.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  pendientes integer;
begin
  select count(*) into pendientes from questions where text like 'ITEM_TEXT_PENDIENTE%';
  if pendientes > 0 then
    raise exception 'Quedan % ítems con texto placeholder tras cargar los textos oficiales', pendientes;
  end if;
end $$;
