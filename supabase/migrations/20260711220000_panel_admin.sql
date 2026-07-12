-- Panel administrativo (Milestone 4).

-- Buckets privados de Storage: política de prevención y contenidos de capacitación.
-- Solo el backend (service_role) sube/lee; no se crean políticas de storage para otros roles.
insert into storage.buckets (id, name, public)
values ('politicas', 'politicas', false), ('capacitacion', 'capacitacion', false)
on conflict (id) do nothing;

-- Sugerencias de acciones (referencia basada en la Tabla 7 de la NOM-035) para niveles
-- medio, alto y muy alto. Son DATOS (regla inviolable 7): la UI solo las lee.
insert into system_config (key, value) values (
  'sugerencias_tabla7',
  '{
    "Ambiente de trabajo": [
      "Realizar verificaciones oculares y entrevistas sobre las condiciones peligrosas e inseguras del centro de trabajo",
      "Establecer un programa de mantenimiento y de dotación de equipo de protección personal",
      "Difundir los resultados de las evaluaciones del ambiente de trabajo y las medidas adoptadas"
    ],
    "Factores propios de la actividad": [
      "Revisar y equilibrar las cargas de trabajo: distribución, plazos y pausas",
      "Involucrar a los trabajadores en la toma de decisiones sobre su trabajo y definir claramente su rol",
      "Establecer objetivos alcanzables y revisar la asignación de responsabilidades"
    ],
    "Organización del tiempo de trabajo": [
      "Revisar la organización de jornadas y rotación de turnos; respetar los tiempos de descanso",
      "Establecer medidas para evitar interferencia entre la vida laboral y familiar (horarios, disponibilidad fuera de jornada)",
      "Promover pausas y periodos de recuperación durante la jornada"
    ],
    "Liderazgo y relaciones en el trabajo": [
      "Capacitar a mandos medios y directivos en liderazgo y comunicación efectiva",
      "Definir y difundir procedimientos de atención a quejas por violencia laboral con protección a denunciantes",
      "Fomentar el trabajo en equipo y la comunicación entre niveles jerárquicos"
    ],
    "Entorno organizacional": [
      "Establecer mecanismos de reconocimiento del desempeño",
      "Comunicar con claridad la contribución del trabajo de cada persona y su estabilidad",
      "Definir esquemas de participación de los trabajadores en la mejora de su entorno"
    ]
  }'
)
on conflict (key) do nothing;
