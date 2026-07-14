-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 4: Programa de intervención (NOM-035 8.3, 8.4, 8.5).
--
-- intervention_programs: el documento "Programa" que exige el 8.3 cuando los
--   resultados caen en medio/alto/muy alto (Tabla 4 de la Guía II / Tabla 7 de la
--   Guía III, idénticas). Campos de nivel programa del 8.4: a) áreas/trabajadores
--   sujetos, e) evaluación posterior, f) responsable de ejecución. Es un documento
--   de TRABAJO (8.4 d exige control de avances): editable, con cambios auditados;
--   lo que se congela como evidencia es su exportación sellada en el expediente.
--
-- action_items se extiende con: pertenencia al programa, áreas por acción (8.4 a),
--   nivel de acción del 8.5, evidencia adjunta y fecha de completado (8.4 d).
--
-- Los criterios por nivel son TEXTO LITERAL del DOF en system_config (regla 7:
--   nada normativo hardcodeado en código).
-- ─────────────────────────────────────────────────────────────────────────────

create table intervention_programs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  cycle_id uuid not null,
  -- 8.4 a): áreas de trabajo y/o trabajadores sujetos al programa
  scope_areas text not null,
  -- 8.4 f): responsable de la ejecución del programa
  responsible text not null,
  -- 8.4 e): evaluación posterior a la aplicación de las medidas ("en su caso")
  post_evaluation text,
  post_evaluation_date date,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  -- Un programa por ciclo: el 8.4 habla de UN documento con acciones dentro.
  unique (company_id, cycle_id),
  foreign key (company_id, cycle_id) references compliance_cycles (company_id, id)
);

alter table action_items
  add column program_id uuid,
  add column target_areas text,
  add column action_level text
    check (action_level in ('primer_nivel', 'segundo_nivel', 'tercer_nivel')),
  add column evidence_path text,
  add column evidence_sha256 text,
  add column completed_at timestamptz,
  add constraint action_items_program_fk
    foreign key (company_id, program_id) references intervention_programs (company_id, id);

alter table intervention_programs enable row level security;

-- Lectura para gestión y RD (app.es_miembro es "empleado con cuenta", no el rol).
create policy intervention_programs_select on intervention_programs for select
  using (app.gestiona_tenant(company_id) or app.es_responsable_designado(company_id));
create policy intervention_programs_insert on intervention_programs for insert
  with check (app.gestiona_tenant(company_id) and created_by = auth.uid());
create policy intervention_programs_update on intervention_programs for update
  using (app.gestiona_tenant(company_id)) with check (app.gestiona_tenant(company_id));
-- Sin política de DELETE: el programa no se borra (su historia queda en audit_log).

grant select, insert, update on intervention_programs to authenticated;
grant all on intervention_programs to service_role;

-- Bucket privado para la evidencia de avance por acción (8.4 d): PDF o imagen
-- validados por magic bytes en el servidor; solo service_role sube/lee.
insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;

-- Criterios para la toma de acciones — TEXTO LITERAL del DOF 23-oct-2018
-- (Tabla 4, Guía de Referencia II y Tabla 7, Guía de Referencia III; idénticas).
-- II.4/III.4: "…a través de un Programa de intervención para los niveles medio,
-- alto y muy alto…". Las accionesSugeridas son la traducción operativa de cada
-- criterio a acciones pre-poblables (editable por el usuario antes de crear).
insert into system_config (key, value) values (
  'criterios_toma_acciones',
  '{
    "titulo": "Criterios para la toma de acciones",
    "fuente": "Tabla 4 (Guía de Referencia II) y Tabla 7 (Guía de Referencia III) del DOF 23-oct-2018; contenido idéntico",
    "exigenPrograma": ["medio", "alto", "muy_alto"],
    "niveles": {
      "muy_alto": {
        "criterio": "Se requiere realizar el análisis de cada categoría y dominio para establecer las acciones de intervención apropiadas, mediante un Programa de intervención que deberá incluir evaluaciones específicas, y contemplar campañas de sensibilización, revisar la política de prevención de riesgos psicosociales y programas para la prevención de los factores de riesgo psicosocial, la promoción de un entorno organizacional favorable y la prevención de la violencia laboral, así como reforzar su aplicación y difusión.",
        "accionesSugeridas": [
          { "descripcion": "Realizar el análisis de cada categoría y dominio en riesgo para establecer las acciones de intervención apropiadas", "nivel_accion": null },
          { "descripcion": "Realizar evaluaciones específicas (estudio a profundidad con instrumentos cuantitativos, cualitativos o mixtos y, en su caso, clínicos) — obligatorias en nivel muy alto", "nivel_accion": "tercer_nivel" },
          { "descripcion": "Realizar una campaña de sensibilización sobre los factores de riesgo psicosocial y la violencia laboral", "nivel_accion": "segundo_nivel" },
          { "descripcion": "Revisar la política de prevención de riesgos psicosociales y los programas de prevención, promoción del entorno organizacional favorable y prevención de la violencia laboral", "nivel_accion": "primer_nivel" },
          { "descripcion": "Reforzar la aplicación y difusión de la política y de los programas de prevención", "nivel_accion": "primer_nivel" }
        ]
      },
      "alto": {
        "criterio": "Se requiere realizar un análisis de cada categoría y dominio, de manera que se puedan determinar las acciones de intervención apropiadas a través de un Programa de intervención, que podrá incluir una evaluación específica y deberá incluir una campaña de sensibilización, revisar la política de prevención de riesgos psicosociales y programas para la prevención de los factores de riesgo psicosocial, la promoción de un entorno organizacional favorable y la prevención de la violencia laboral, así como reforzar su aplicación y difusión.",
        "accionesSugeridas": [
          { "descripcion": "Realizar el análisis de cada categoría y dominio en riesgo para establecer las acciones de intervención apropiadas", "nivel_accion": null },
          { "descripcion": "Realizar una campaña de sensibilización sobre los factores de riesgo psicosocial y la violencia laboral", "nivel_accion": "segundo_nivel" },
          { "descripcion": "Revisar la política de prevención de riesgos psicosociales y los programas de prevención, promoción del entorno organizacional favorable y prevención de la violencia laboral", "nivel_accion": "primer_nivel" },
          { "descripcion": "Reforzar la aplicación y difusión de la política y de los programas de prevención", "nivel_accion": "primer_nivel" }
        ]
      },
      "medio": {
        "criterio": "Se requiere revisar la política de prevención de riesgos psicosociales y programas para la prevención de los factores de riesgo psicosocial, la promoción de un entorno organizacional favorable y la prevención de la violencia laboral, así como reforzar su aplicación y difusión, mediante un Programa de intervención.",
        "accionesSugeridas": [
          { "descripcion": "Revisar la política de prevención de riesgos psicosociales y los programas de prevención, promoción del entorno organizacional favorable y prevención de la violencia laboral", "nivel_accion": "primer_nivel" },
          { "descripcion": "Reforzar la aplicación y difusión de la política y de los programas de prevención", "nivel_accion": "primer_nivel" }
        ]
      },
      "bajo": {
        "criterio": "Es necesario una mayor difusión de la política de prevención de riesgos psicosociales y programas para: la prevención de los factores de riesgo psicosocial, la promoción de un entorno organizacional favorable y la prevención de la violencia laboral.",
        "accionesSugeridas": []
      },
      "nulo": {
        "criterio": "El riesgo resulta despreciable por lo que no se requiere medidas adicionales.",
        "accionesSugeridas": []
      }
    }
  }'::jsonb
)
on conflict (key) do update set value = excluded.value;
