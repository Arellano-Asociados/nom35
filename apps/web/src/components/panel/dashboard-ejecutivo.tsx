import Link from 'next/link';
import type { ReactNode } from 'react';
import { ResumenIA } from '@/components/panel/resumen-ia';
import { TablaDistribucion } from '@/components/panel/tabla-distribucion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FLAGS, flagActiva } from '@/lib/flags';
import { ultimoBorrador } from '@/lib/ia/borradores';
import { proveedorIA } from '@/lib/ia/proveedor';
import { clienteSesion } from '@/lib/supabase-servidor';
import { exigePrograma, type CriteriosTomaAcciones } from '@/lib/programa';
import { cicloActivoDe, clasificarVencimiento, type CicloTablero } from '@/lib/tablero';
import {
  conteoCanalizacionesAbiertas,
  semaforoGlobal,
  semaforoPorCentro,
  vigentesDeCiclo,
} from '@/lib/tablero-datos';

interface PuntuadoJson {
  nombre: string;
  nivel: string;
}

function Tile({ etiqueta, valor, tono }: { etiqueta: string; valor: ReactNode; tono?: 'alerta' }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <p className="text-xs text-texto-secundario">{etiqueta}</p>
        <p
          className={
            tono === 'alerta'
              ? 'text-2xl font-semibold tracking-tight text-peligro tabular-nums'
              : 'text-2xl font-semibold tracking-tight text-texto tabular-nums'
          }
        >
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Dashboard ejecutivo (spec §1): estado del ciclo activo de un vistazo, sobre las mismas
 * fuentes agregadas del panel (nada nuevo se expone). Se muestra cuando la empresa ya
 * opera; el checklist de onboarding cubre el arranque.
 */
export async function DashboardEjecutivo({ empresa }: { empresa: string }) {
  const supabase = await clienteSesion();
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: ciclosData } = await supabase
    .from('compliance_cycles')
    .select('id, name, date_start, date_end, traumatic_event_id')
    .eq('company_id', empresa)
    .is('traumatic_event_id', null); // los ciclos ATS no gobiernan el tablero ejecutivo

  const ciclos: CicloTablero[] = (ciclosData ?? []).map((c) => ({
    id: c.id,
    dateStart: c.date_start,
    dateEnd: c.date_end,
  }));
  const activo = cicloActivoDe(ciclos, hoy);
  const nombreCiclo = ciclosData?.find((c) => c.id === activo?.id)?.name ?? '';

  if (!activo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sin ciclo activo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-texto-secundario">
          No hay un ciclo de evaluación en curso. Crea o abre uno para ver aquí su avance y su
          semáforo de resultados.{' '}
          <Link href={`/panel/${empresa}/ciclos`} className="text-marca-700 underline">
            Ir a Ciclos
          </Link>
          .
        </CardContent>
      </Card>
    );
  }

  // Avance por centro (participación — sesión/RLS): asignados y completados del ciclo.
  const { data: asignaciones } = await supabase
    .from('questionnaire_assignments')
    .select('completed_at, employees (work_centers (name))')
    .eq('company_id', empresa)
    .eq('cycle_id', activo.id);

  const avancePorCentro = new Map<string, { asignados: number; completados: number }>();
  for (const a of asignaciones ?? []) {
    const centro =
      (a.employees as unknown as { work_centers: { name: string } | null })?.work_centers?.name ??
      'Sin centro';
    const acc = avancePorCentro.get(centro) ?? { asignados: 0, completados: 0 };
    acc.asignados++;
    if (a.completed_at) acc.completados++;
    avancePorCentro.set(centro, acc);
  }
  const totalAsignados = (asignaciones ?? []).length;
  const totalCompletados = (asignaciones ?? []).filter((a) => a.completed_at).length;
  const sinResponder = totalAsignados - totalCompletados;

  // Semáforo (agregado ya suprimido — service_role vía tablero-datos).
  const vigentes = await vigentesDeCiclo(empresa, activo.id);
  const global = semaforoGlobal(vigentes);
  const porCentro = semaforoPorCentro(vigentes);
  const canalizacionesAbiertas = await conteoCanalizacionesAbiertas(empresa, activo.id);

  // Pendientes normativos: programa exigido y no creado, política sin publicar.
  const [{ data: criteriosRow }, { count: programasCount }, { count: politicasCount }] =
    await Promise.all([
      supabase
        .from('system_config')
        .select('value')
        .eq('key', 'criterios_toma_acciones')
        .maybeSingle(),
      supabase
        .from('intervention_programs')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', empresa)
        .eq('cycle_id', activo.id),
      supabase
        .from('policies')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', empresa),
    ]);

  const criterios = (criteriosRow?.value as CriteriosTomaAcciones | undefined) ?? null;
  const nivelesPresentes = [
    ...new Set(
      vigentes.flatMap((r) => [
        r.nivelFinal,
        ...r.categorias.map((c: PuntuadoJson) => c.nivel),
        ...r.dominios.map((d: PuntuadoJson) => d.nivel),
      ]),
    ),
  ];
  const programaExigido = criterios ? exigePrograma(nivelesPresentes, criterios) : false;
  const programaFalta = programaExigido && (programasCount ?? 0) === 0;
  const politicaFalta = (politicasCount ?? 0) === 0;

  // Vencimientos: reevaluación bienal + acciones del programa con fecha compromiso.
  const [{ data: alertas }, { data: acciones }] = await Promise.all([
    supabase
      .from('work_centers_alerta_ciclo')
      .select('name, requiere_nueva_evaluacion')
      .eq('company_id', empresa),
    supabase
      .from('action_items')
      .select('description, due_date, status')
      .eq('company_id', empresa)
      .neq('status', 'completada')
      .not('due_date', 'is', null),
  ]);

  const centrosBienalVencida = (alertas ?? []).filter((a) => a.requiere_nueva_evaluacion);
  const accionesClasificadas = (acciones ?? [])
    .map((a) => ({
      descripcion: a.description,
      dueDate: a.due_date as string,
      estado: clasificarVencimiento(a.due_date, hoy),
    }))
    .filter(
      (a): a is { descripcion: string; dueDate: string; estado: 'vencido' | 'proximo' } =>
        a.estado !== 'al_corriente',
    )
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate));

  const participacion =
    totalAsignados > 0 ? Math.round((totalCompletados / totalAsignados) * 100) : null;

  const etiquetaVenc: Record<'vencido' | 'proximo', string> = {
    vencido: 'Vencida',
    proximo: 'Próxima',
  };

  // Franja de resumen ejecutivo IA: solo con el flag activo (spec §5).
  const iaActiva = await flagActiva(empresa, FLAGS.iaAsistida, false);
  const borradorResumen = iaActiva
    ? await ultimoBorrador(empresa, activo.id, 'resumen_ejecutivo')
    : null;
  const iaDisponible = proveedorIA().disponible();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-texto">Estado de {nombreCiclo}</h1>
        <p className="text-sm text-texto-secundario">
          Resumen ejecutivo del ciclo activo. Nunca muestra respuestas ni resultados individuales:
          solo participación y distribuciones con supresión de grupos menores a 3.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile etiqueta="Participación" valor={participacion === null ? '—' : `${participacion}%`} />
        <Tile
          etiqueta="Sin responder"
          valor={sinResponder}
          tono={sinResponder > 0 ? 'alerta' : undefined}
        />
        <Tile
          etiqueta="Canalizaciones GR-I abiertas"
          valor={canalizacionesAbiertas}
          tono={canalizacionesAbiertas > 0 ? 'alerta' : undefined}
        />
        <Tile
          etiqueta="Reevaluación bienal pendiente"
          valor={centrosBienalVencida.length}
          tono={centrosBienalVencida.length > 0 ? 'alerta' : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Avance por centro</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs text-texto-secundario uppercase">
                  <th className="py-2 pr-3">Centro</th>
                  <th className="py-2 text-right">Completados / Asignados</th>
                </tr>
              </thead>
              <tbody>
                {[...avancePorCentro.entries()]
                  .sort(([a], [b]) => a.localeCompare(b, 'es'))
                  .map(([centro, c]) => (
                    <tr key={centro} className="border-b border-borde/60">
                      <td className="py-2 pr-3">{centro}</td>
                      <td className="py-2 text-right tabular-nums">
                        {c.completados} / {c.asignados}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pendientes normativos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <PendienteFila
              activo={sinResponder > 0}
              texto={`${sinResponder} cuestionario(s) sin responder`}
              ok="Todos los cuestionarios están respondidos."
            />
            <PendienteFila
              activo={canalizacionesAbiertas > 0}
              texto={`${canalizacionesAbiertas} canalización(es) GR-I pendiente(s) de atención (solo el Responsable Designado ve el detalle)`}
              ok="Sin canalizaciones GR-I abiertas."
            />
            <PendienteFila
              activo={programaFalta}
              texto="Los resultados exigen un Programa de intervención y aún no se ha creado."
              ok="El Programa de intervención está al día (o no es exigible)."
              href={programaFalta ? `/panel/${empresa}/ciclos/${activo.id}/acciones` : undefined}
            />
            <PendienteFila
              activo={politicaFalta}
              texto="No has publicado tu política de prevención (obligatoria)."
              ok="La política de prevención está publicada."
              href={politicaFalta ? `/panel/${empresa}/politica` : undefined}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Semáforo global</CardTitle>
        </CardHeader>
        <CardContent>
          {vigentes.length === 0 ? (
            <p className="text-sm text-texto-secundario">
              Aún no hay resultados: el semáforo se llena conforme los empleados responden.
            </p>
          ) : (
            <TablaDistribucion
              testid="tablero-semaforo-global"
              filas={[{ nombre: 'Calificación final', distribucion: global }]}
            />
          )}
        </CardContent>
      </Card>

      {porCentro.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Semáforo por centro</CardTitle>
          </CardHeader>
          <CardContent>
            <TablaDistribucion
              testid="tablero-semaforo-centro"
              filas={porCentro.map((c) => ({ nombre: c.centro, distribucion: c.distribucion }))}
            />
            <p className="mt-2 text-xs text-texto-secundario">
              Un centro con menos de 3 respuestas aparece enmascarado ("—"): grupo pequeño, no
              reportable.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Próximos vencimientos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {centrosBienalVencida.length === 0 && accionesClasificadas.length === 0 ? (
            <p className="text-texto-secundario">Sin vencimientos próximos ni vencidos.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {centrosBienalVencida.map((c) => (
                <li key={c.name} className="text-peligro">
                  Reevaluación bienal vencida — {c.name}
                </li>
              ))}
              {accionesClasificadas.map((a, i) => (
                <li key={i} className={a.estado === 'vencido' ? 'text-peligro' : 'text-amber-700'}>
                  {etiquetaVenc[a.estado]} ({a.dueDate}) — {a.descripcion}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {iaActiva && (
        <ResumenIA
          companyId={empresa}
          cycleId={activo.id}
          disponible={iaDisponible}
          borrador={borradorResumen}
        />
      )}
    </div>
  );
}

function PendienteFila({
  activo,
  texto,
  ok,
  href,
}: {
  activo: boolean;
  texto: string;
  ok: string;
  href?: string;
}) {
  if (!activo) {
    return (
      <p className="flex items-center gap-2 text-texto-secundario">
        <span aria-hidden className="text-exito">
          ✓
        </span>
        {ok}
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2 text-peligro">
      <span aria-hidden>•</span>
      <span>
        {texto}
        {href && (
          <>
            {' '}
            <Link href={href} className="underline">
              Resolver
            </Link>
          </>
        )}
      </span>
    </p>
  );
}
