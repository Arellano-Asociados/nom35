import { accionCrearAccion, accionActualizarAccion } from '@/acciones/panel';
import {
  accionActualizarPrograma,
  accionCrearPrograma,
  accionSubirEvidenciaAccion,
} from '@/acciones/programa';
import { AccionAvance } from '@/components/panel/accion-avance';
import { BadgeNivel } from '@/components/panel/badges';
import { claseCampo, claseEstadoVacio } from '@/components/panel/campos';
import { CrearPrograma } from '@/components/panel/crear-programa';
import { ErrorFormulario } from '@/components/panel/error-formulario';
import { AvisoRolSinGestion } from '@/components/panel/aviso-rol';
import { PlanIA } from '@/components/panel/plan-ia';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { autorizarEmpresa, puedeGestionar } from '@/lib/autorizacion';
import { fechaEsMx } from '@/lib/fechas';
import { FLAGS, flagActiva } from '@/lib/flags';
import { ultimoBorrador } from '@/lib/ia/borradores';
import { proveedorIA } from '@/lib/ia/proveedor';
import { validarPlan } from '@/lib/ia/validar-salida';
import { resultadosVigentesPorAsignacion } from '@/lib/informe';
import {
  accionesPrePobladas,
  exigePrograma,
  ETIQUETA_NIVEL_ACCION,
  type CriteriosTomaAcciones,
  type NivelAccion,
} from '@/lib/programa';
import { clienteSesion } from '@/lib/supabase-servidor';
import { clienteAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Estatus de BD traducido (fila 11 del copy de la auditoría v0: "en_progreso" crudo).
const ETIQUETA_ESTATUS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
};

const ORDEN_NIVELES = ['nulo', 'bajo', 'medio', 'alto', 'muy_alto'];

interface PuntuadoJson {
  nombre: string;
  nivel: string;
}

export default async function PaginaPrograma({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string; ciclo: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { empresa, ciclo } = await params;
  const { error } = await searchParams;
  const acceso = await autorizarEmpresa(empresa);
  if (!puedeGestionar(acceso.membresia)) return <AvisoRolSinGestion />;

  // Fase 2.5: las lecturas de gestión van con el cliente de sesión (RLS real).
  // ÚNICA excepción: risk_results se agrega con service_role porque el rol patronal
  // no tiene (ni debe tener) SELECT sobre resultados individuales — reglas 4/5;
  // de aquí solo salen niveles detectados y conteos, jamás filas individuales.
  const supabase = await clienteSesion();
  const admin = clienteAdmin();
  const [{ data: programa }, { data: acciones }, { data: resultados }, { data: config }] =
    await Promise.all([
      supabase
        .from('intervention_programs')
        .select('id, scope_areas, responsible, post_evaluation, post_evaluation_date, created_at')
        .eq('company_id', empresa)
        .eq('cycle_id', ciclo)
        .maybeSingle(),
      supabase
        .from('action_items')
        .select(
          'id, description, origin_level, responsible, due_date, status, target_areas, action_level, evidence_sha256, completed_at',
        )
        .eq('company_id', empresa)
        .eq('cycle_id', ciclo)
        .order('created_at'),
      admin
        .from('risk_results')
        .select('id, assignment_id, supersedes_id, created_at, nivel_final, categorias, dominios')
        .eq('company_id', empresa)
        .eq('cycle_id', ciclo),
      supabase
        .from('system_config')
        .select('value')
        .eq('key', 'criterios_toma_acciones')
        .maybeSingle(),
    ]);

  // Mismo criterio que el dashboard y el informe de resultados (regla inviolable 1): la
  // obligación del programa se determina solo con la fila VIGENTE por asignación.
  const vigentes = resultadosVigentesPorAsignacion(
    (resultados ?? []).map((r) => ({
      id: r.id,
      assignmentId: r.assignment_id,
      supersedesId: r.supersedes_id,
      createdAt: r.created_at,
      nivel_final: r.nivel_final,
      categorias: r.categorias,
      dominios: r.dominios,
    })),
  );

  // Niveles detectados en el ciclo: Cfinal + categorías + dominios de los vigentes
  // (II.4/III.4: el criterio aplica al resultado de cada cuestionario).
  const nivelesPresentes = [
    ...new Set(
      vigentes.flatMap((r) => [
        r.nivel_final,
        ...(r.categorias as PuntuadoJson[]).map((c) => c.nivel),
        ...(r.dominios as PuntuadoJson[]).map((d) => d.nivel),
      ]),
    ),
  ];

  const criterios = (config?.value ?? null) as CriteriosTomaAcciones | null;
  const exige = criterios ? exigePrograma(nivelesPresentes, criterios) : false;
  const sugeridas = criterios ? accionesPrePobladas(nivelesPresentes, criterios) : [];
  const nivelesQueExigen = criterios
    ? [...new Set(nivelesPresentes.filter((n) => criterios.exigenPrograma.includes(n)))].sort(
        (a, b) => ORDEN_NIVELES.indexOf(b) - ORDEN_NIVELES.indexOf(a),
      )
    : [];

  const completadas = (acciones ?? []).filter((a) => a.status === 'completada').length;
  const crear = accionCrearAccion.bind(null, empresa, ciclo);

  // Plan de acción asistido por IA (Fase 6 §6): solo con el flag activo y cuando el ciclo
  // exige programa. El insumo/validación usan el mismo catálogo Tabla 4/7 de `criterios`.
  const iaActiva = await flagActiva(empresa, FLAGS.iaAsistida, false);
  const borradorPlan = iaActiva ? await ultimoBorrador(empresa, ciclo, 'plan_accion') : null;
  const anclasCatalogo = criterios
    ? criterios.exigenPrograma.flatMap(
        (nivel) => criterios.niveles[nivel]?.accionesSugeridas.map((a) => a.descripcion) ?? [],
      )
    : [];
  const medidasPlan =
    borradorPlan && !borradorPlan.adoptado
      ? validarPlan(borradorPlan.texto, anclasCatalogo).medidas
      : [];
  const nivelOrigenPlan = nivelesQueExigen[0] ?? 'medio';
  const iaDisponible = proveedorIA().disponible();

  return (
    <div className="flex flex-col gap-4">
      {/* Plan de acción asistido por IA (Fase 6): borrador editable que se adopta al
          programa. Solo con flag activo y cuando el ciclo exige programa. */}
      {iaActiva && exige && (
        <PlanIA
          companyId={empresa}
          cycleId={ciclo}
          disponible={iaDisponible}
          nivelOrigen={nivelOrigenPlan}
          borrador={borradorPlan}
          medidasIniciales={medidasPlan}
        />
      )}

      {/* Estado normativo del ciclo */}
      {!programa && exige && criterios && (
        <Card data-testid="banner-exige-programa">
          <CardHeader>
            <CardTitle>Este ciclo exige un Programa de intervención</CardTitle>
            <p className="text-xs text-texto-secundario">
              {criterios.fuente} — obligatorio para los niveles medio, alto y muy alto (numerales
              8.3 y 8.4 de la NOM-035)
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-700">
            {nivelesQueExigen.map((nivel) => (
              <div key={nivel} className="flex flex-col gap-1">
                <BadgeNivel nivel={nivel} />
                <p className="text-xs leading-relaxed text-slate-600">
                  {criterios.niveles[nivel]?.criterio}
                </p>
              </div>
            ))}
            <CrearPrograma
              sugeridas={sugeridas}
              crear={accionCrearPrograma.bind(null, empresa, ciclo)}
            />
          </CardContent>
        </Card>
      )}

      {!programa && !exige && (
        <Card>
          <CardHeader>
            <CardTitle>Programa de intervención</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">
            {vigentes.length === 0
              ? 'Aún no hay resultados en este ciclo. Cuando los haya, aquí sabrás si la norma exige un Programa de intervención (niveles medio, alto o muy alto).'
              : 'Ningún resultado vigente del ciclo está en nivel medio, alto o muy alto: la norma no exige Programa de intervención (Tabla de criterios de las guías). Aun así puedes registrar acciones preventivas abajo.'}
          </CardContent>
        </Card>
      )}

      {programa && (
        <Card data-testid="programa-detalle">
          <CardHeader>
            <CardTitle>Programa de intervención (8.4)</CardTitle>
            <p className="text-xs text-texto-secundario">
              Creado el {fechaEsMx(programa.created_at)} · Avance: {completadas} de{' '}
              {(acciones ?? []).length} acciones completadas
            </p>
          </CardHeader>
          <CardContent>
            <ErrorFormulario codigo={error} />
            <form
              action={accionActualizarPrograma.bind(null, empresa, ciclo, programa.id)}
              className="mt-3 grid gap-3 text-sm sm:grid-cols-2"
            >
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Áreas y/o trabajadores sujetos (8.4 a)
                <input
                  name="areas"
                  required
                  defaultValue={programa.scope_areas}
                  className={claseCampo}
                />
              </label>
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Responsable de la ejecución (8.4 f)
                <input
                  name="responsable"
                  required
                  defaultValue={programa.responsible}
                  className={claseCampo}
                />
              </label>
              <label className="flex flex-col gap-1 font-medium text-slate-800 sm:col-span-2">
                Evaluación posterior a las medidas de control (8.4 e, cuando aplique)
                <textarea
                  name="evaluacion"
                  rows={2}
                  defaultValue={programa.post_evaluation ?? ''}
                  className={claseCampo}
                />
              </label>
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Fecha de la evaluación posterior
                <input
                  name="fecha_evaluacion"
                  type="date"
                  defaultValue={programa.post_evaluation_date ?? ''}
                  className={claseCampo}
                />
              </label>
              <div className="flex items-end">
                <BotonGuardarPrograma />
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Acciones del programa</CardTitle>
            <p className="text-xs text-texto-secundario">
              Tipo de acciones, fechas y control de avances (8.4 b–d) con evidencia adjunta
            </p>
          </CardHeader>
          <CardContent>
            {(acciones ?? []).length === 0 ? (
              <p className={claseEstadoVacio}>
                Aún no hay acciones registradas. Registra la primera con el formulario.
              </p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm" data-testid="lista-acciones">
                {(acciones ?? []).map((a) => (
                  <li key={a.id} className="rounded-md border border-slate-200 px-4 py-3">
                    <p className="font-medium text-slate-900">{a.description}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-slate-600">
                      <span>Nivel de origen:</span>
                      <BadgeNivel nivel={a.origin_level} />
                      <span>· Responsable: {a.responsible} ·</span>
                      <span>{a.due_date ? fechaEsMx(a.due_date) : 'sin fecha'}</span>
                      <span>· {ETIQUETA_ESTATUS[a.status] ?? a.status}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      {a.action_level && (
                        <span>{ETIQUETA_NIVEL_ACCION[a.action_level as NivelAccion]}</span>
                      )}
                      {a.target_areas && <span>· Áreas: {a.target_areas}</span>}
                      {a.completed_at && <span>· Completada el {fechaEsMx(a.completed_at)}</span>}
                      {a.evidence_sha256 && (
                        <span title={a.evidence_sha256}>· Evidencia adjunta ✓</span>
                      )}
                    </p>
                    <div className="mt-2">
                      <AccionAvance
                        accionId={a.id}
                        estatusActual={a.status as 'pendiente' | 'en_progreso' | 'completada'}
                        tieneEvidencia={Boolean(a.evidence_sha256)}
                        actualizar={accionActualizarAccion.bind(null, empresa)}
                        subirEvidencia={accionSubirEvidenciaAccion.bind(null, empresa)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrar acción</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={crear} className="flex flex-col gap-3 text-sm">
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Descripción
                <textarea name="descripcion" required rows={3} className={claseCampo} />
              </label>
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Nivel de riesgo de origen
                <select name="nivel" required className={claseCampo}>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                  <option value="muy_alto">Muy alto</option>
                  <option value="bajo">Bajo</option>
                  <option value="nulo">Nulo</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Nivel de acción (8.5)
                <select name="nivel_accion" className={claseCampo}>
                  <option value="">Sin clasificar</option>
                  <option value="primer_nivel">Primer nivel (organizacional)</option>
                  <option value="segundo_nivel">Segundo nivel (grupal)</option>
                  <option value="tercer_nivel">Tercer nivel (individual / clínico)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Áreas o trabajadores a los que aplica
                <input name="areas" className={claseCampo} />
              </label>
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Responsable
                <input name="responsable" required className={claseCampo} />
              </label>
              <label className="flex flex-col gap-1 font-medium text-slate-800">
                Fecha compromiso
                <input name="fecha" type="date" className={claseCampo} />
              </label>
              <Button type="submit">Registrar acción</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** El submit del programa usa una acción que devuelve ResultadoPanel: botón simple. */
function BotonGuardarPrograma() {
  return (
    <Button type="submit" variant="secondary" data-testid="programa-guardar">
      Guardar programa
    </Button>
  );
}
