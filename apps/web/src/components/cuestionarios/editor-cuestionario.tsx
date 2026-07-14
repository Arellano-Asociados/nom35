'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  accionGuardarBorrador,
  accionPublicarCuestionario,
  type ResultadoCuestionario,
} from '@/acciones/cuestionarios';
import { RenderCuestionario } from '@/components/cuestionarios/render-cuestionario';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DialogoConfirmacion } from '@/components/ui/dialogo-confirmacion';
import { claseControl } from '@/components/ui/input';
import type {
  DefinicionCuestionario,
  PreguntaPersonalizada,
  SeccionPersonalizada,
  TipoPregunta,
} from '@/lib/cuestionarios';
import { cn } from '@/lib/utils';

const TIPOS: Array<{ valor: TipoPregunta; etiqueta: string }> = [
  { valor: 'likert5', etiqueta: 'Escala (Siempre … Nunca)' },
  { valor: 'opcion_multiple', etiqueta: 'Opción múltiple' },
  { valor: 'si_no', etiqueta: 'Sí / No' },
  { valor: 'abierta', etiqueta: 'Respuesta abierta' },
];

const nuevoId = () => crypto.randomUUID().slice(0, 8);

/** Preguntas cerradas ANTERIORES a la sección dada (candidatas de condición). */
function preguntasPrevias(def: DefinicionCuestionario, indiceSeccion: number) {
  return def.secciones
    .slice(0, indiceSeccion)
    .flatMap((s) => s.preguntas)
    .filter((p) => p.tipo !== 'abierta');
}

export function EditorCuestionario({
  companyId,
  id,
  tituloInicial,
  definicionInicial,
}: {
  companyId: string;
  id: string;
  tituloInicial: string;
  definicionInicial: DefinicionCuestionario;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(tituloInicial);
  const [def, setDef] = useState<DefinicionCuestionario>(definicionInicial);
  const [previa, setPrevia] = useState(false);
  const [respuestasPrevia, setRespuestasPrevia] = useState<Record<string, string>>({});
  const [confirmaPublicar, setConfirmaPublicar] = useState(false);
  const [erroresPublicar, setErroresPublicar] = useState<string[]>([]);
  const [ocupado, startTransition] = useTransition();

  const mutarSeccion = (i: number, cambio: Partial<SeccionPersonalizada>) =>
    setDef((d) => ({
      secciones: d.secciones.map((s, j) => (j === i ? { ...s, ...cambio } : s)),
    }));

  const mutarPregunta = (i: number, j: number, cambio: Partial<PreguntaPersonalizada>) =>
    setDef((d) => ({
      secciones: d.secciones.map((s, si) =>
        si === i
          ? { ...s, preguntas: s.preguntas.map((p, pj) => (pj === j ? { ...p, ...cambio } : p)) }
          : s,
      ),
    }));

  const guardar = (luego?: () => void) =>
    startTransition(async () => {
      const r = await accionGuardarBorrador(companyId, id, titulo, def);
      if (!r.ok) {
        toast.error(r.error ?? 'No se pudo guardar');
        return;
      }
      toast.success('Borrador guardado');
      luego?.();
    });

  const publicar = () =>
    startTransition(async () => {
      // Publicar SIEMPRE guarda primero: lo sellado es lo que está en pantalla.
      const g = await accionGuardarBorrador(companyId, id, titulo, def);
      if (!g.ok) {
        toast.error(g.error ?? 'No se pudo guardar antes de publicar');
        return;
      }
      const r: ResultadoCuestionario = await accionPublicarCuestionario(companyId, id);
      if (!r.ok) {
        setErroresPublicar(r.detalle ?? (r.error ? [r.error] : []));
        toast.error(r.error ?? 'No se pudo publicar');
        return;
      }
      toast.success('Cuestionario publicado: desde ahora es inmutable');
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex-1 text-sm font-medium text-slate-800">
          <span className="sr-only">Título del cuestionario</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            data-testid="cp-titulo"
            className={cn(claseControl, 'text-lg font-semibold')}
            placeholder="Título del cuestionario"
          />
        </label>
        <Button variant="outline" onClick={() => setPrevia((v) => !v)} data-testid="cp-previa">
          {previa ? 'Volver al editor' : 'Vista previa'}
        </Button>
        <Button
          variant="secondary"
          cargando={ocupado}
          onClick={() => guardar()}
          data-testid="cp-guardar"
        >
          Guardar borrador
        </Button>
        <Button
          cargando={ocupado}
          onClick={() => setConfirmaPublicar(true)}
          data-testid="cp-publicar"
        >
          Publicar
        </Button>
      </div>

      {erroresPublicar.length > 0 && (
        <ul
          role="alert"
          className="rounded-md border border-peligro-borde bg-peligro-fondo p-3 text-sm text-peligro-texto"
        >
          {erroresPublicar.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {previa ? (
        // Marco móvil: la previa es EXACTAMENTE el renderizador del empleado a 390px.
        <div
          className="mx-auto w-full max-w-[390px] rounded-2xl border-4 border-slate-300 bg-fondo p-3"
          data-testid="cp-marco-previa"
        >
          <p className="mb-2 text-center text-xs text-texto-terciario">
            Vista previa · así lo verá el empleado en su teléfono
          </p>
          <RenderCuestionario
            definicion={def}
            respuestas={respuestasPrevia}
            onResponder={(pid, v) => setRespuestasPrevia((r) => ({ ...r, [pid]: v }))}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {def.secciones.map((seccion, i) => {
            const previas = preguntasPrevias(def, i);
            return (
              <Card key={seccion.id} data-testid={`cp-seccion-${i}`}>
                <CardHeader className="flex-row items-center justify-between gap-3">
                  <input
                    value={seccion.titulo}
                    onChange={(e) => mutarSeccion(i, { titulo: e.target.value })}
                    placeholder={`Título de la sección ${i + 1}`}
                    aria-label={`Título de la sección ${i + 1}`}
                    className={cn(claseControl, 'font-semibold')}
                  />
                  <Button
                    variant="fantasma"
                    size="sm"
                    onClick={() =>
                      setDef((d) => ({ secciones: d.secciones.filter((_, j) => j !== i) }))
                    }
                  >
                    Quitar sección
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  {previas.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-3 text-sm">
                      <span className="text-texto-secundario">Mostrar esta sección</span>
                      <select
                        value={seccion.condicion?.preguntaId ?? ''}
                        onChange={(e) =>
                          mutarSeccion(
                            i,
                            e.target.value
                              ? {
                                  condicion: {
                                    preguntaId: e.target.value,
                                    valor: seccion.condicion?.valor ?? '',
                                  },
                                }
                              : { condicion: undefined },
                          )
                        }
                        aria-label="Condición: pregunta"
                        className={cn(claseControl, 'w-auto')}
                      >
                        <option value="">siempre</option>
                        {previas.map((p) => (
                          <option key={p.id} value={p.id}>
                            si «{p.texto || p.id}»
                          </option>
                        ))}
                      </select>
                      {seccion.condicion && (
                        <>
                          <span className="text-texto-secundario">es</span>
                          <input
                            value={seccion.condicion.valor}
                            onChange={(e) =>
                              mutarSeccion(i, {
                                condicion: {
                                  preguntaId: seccion.condicion!.preguntaId,
                                  valor: e.target.value,
                                },
                              })
                            }
                            placeholder="valor (p. ej. si)"
                            aria-label="Condición: valor"
                            className={cn(claseControl, 'w-40')}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {seccion.preguntas.map((pregunta, j) => (
                    <div
                      key={pregunta.id}
                      className="flex flex-col gap-2 rounded-md border border-borde p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={pregunta.texto}
                          onChange={(e) => mutarPregunta(i, j, { texto: e.target.value })}
                          placeholder="Texto de la pregunta"
                          aria-label={`Pregunta ${j + 1} de la sección ${i + 1}`}
                          className={cn(claseControl, 'flex-1')}
                        />
                        <select
                          value={pregunta.tipo}
                          onChange={(e) =>
                            mutarPregunta(i, j, {
                              tipo: e.target.value as TipoPregunta,
                              opciones:
                                e.target.value === 'opcion_multiple'
                                  ? (pregunta.opciones ?? ['', ''])
                                  : undefined,
                            })
                          }
                          aria-label="Tipo de pregunta"
                          className={cn(claseControl, 'w-auto')}
                        >
                          {TIPOS.map((t) => (
                            <option key={t.valor} value={t.valor}>
                              {t.etiqueta}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="fantasma"
                          size="sm"
                          onClick={() =>
                            mutarSeccion(i, {
                              preguntas: seccion.preguntas.filter((_, pj) => pj !== j),
                            })
                          }
                        >
                          Quitar
                        </Button>
                      </div>
                      {pregunta.tipo === 'opcion_multiple' && (
                        <label className="flex flex-col gap-1 text-xs text-texto-secundario">
                          Opciones (una por línea, mínimo 2)
                          <textarea
                            rows={3}
                            value={(pregunta.opciones ?? []).join('\n')}
                            onChange={(e) =>
                              mutarPregunta(i, j, { opciones: e.target.value.split('\n') })
                            }
                            className={cn(claseControl, 'text-sm')}
                          />
                        </label>
                      )}
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`cp-agregar-pregunta-${i}`}
                    onClick={() =>
                      mutarSeccion(i, {
                        preguntas: [
                          ...seccion.preguntas,
                          { id: nuevoId(), texto: '', tipo: 'likert5' },
                        ],
                      })
                    }
                  >
                    Agregar pregunta
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          <Button
            variant="outline"
            data-testid="cp-agregar-seccion"
            onClick={() =>
              setDef((d) => ({
                secciones: [...d.secciones, { id: nuevoId(), titulo: '', preguntas: [] }],
              }))
            }
          >
            Agregar sección
          </Button>
        </div>
      )}

      <DialogoConfirmacion
        abierto={confirmaPublicar}
        titulo="¿Publicar este cuestionario?"
        etiquetaConfirmar="Publicar y sellar"
        testid="cp-publicar-confirmacion"
        onConfirmar={() => {
          setConfirmaPublicar(false);
          publicar();
        }}
        onCerrar={() => setConfirmaPublicar(false)}
      >
        Al publicarlo se sella con su huella de integridad y se vuelve inmutable: para cambiarlo
        después tendrás que crear una nueva versión. Podrás distribuirlo a los empleados activos.
      </DialogoConfirmacion>
    </div>
  );
}
