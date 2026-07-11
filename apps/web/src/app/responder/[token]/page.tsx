import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  obtenerContexto,
  obtenerEstructura,
  obtenerPreguntas,
  respuestasVigentes,
} from '@/lib/flujo';
import { Consentimiento } from './componentes/consentimiento';
import { Cuestionario, type SeccionUI } from './componentes/cuestionario';
import { Filtros } from './componentes/filtros';
import { Resultado } from './componentes/resultado';

export const dynamic = 'force-dynamic';

const TITULOS_GR1: Record<string, string> = {
  I: 'Sección I. Acontecimiento traumático severo',
  II: 'Sección II. Recuerdos persistentes sobre el acontecimiento (último mes)',
  III: 'Sección III. Esfuerzo por evitar circunstancias parecidas o asociadas (último mes)',
  IV: 'Sección IV. Afectación (último mes)',
};

function Mensaje({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-relaxed text-slate-700">{children}</CardContent>
    </Card>
  );
}

export default async function PaginaResponder({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await obtenerContexto(token);

  if (!ctx) {
    return (
      <Mensaje titulo="Enlace inválido">
        Este enlace no corresponde a ningún cuestionario. Verifica que lo hayas copiado completo o
        solicita uno nuevo a tu centro de trabajo.
      </Mensaje>
    );
  }

  if (ctx.completado) {
    return (
      <div className="flex flex-col gap-4">
        <div
          data-testid="confirmacion"
          className="rounded-md bg-emerald-50 p-4 text-sm font-medium text-emerald-900"
        >
          Tu cuestionario fue enviado. Gracias por tu participación. Puedes volver a esta página con
          tu mismo enlace para consultar tu resultado.
        </div>
        <Resultado asignacionId={ctx.asignacionId} guia={ctx.guia} />
      </div>
    );
  }

  if (ctx.expirado) {
    return (
      <Mensaje titulo="Enlace expirado">
        <span data-testid="expirado">
          Este enlace ya no está vigente. Solicita uno nuevo al responsable de tu centro de trabajo.
        </span>
      </Mensaje>
    );
  }

  if (!ctx.consentido) {
    return (
      <Consentimiento
        token={token}
        razonSocial={ctx.empresa.razonSocial}
        version={ctx.empresa.versionAvisoPrivacidad}
      />
    );
  }

  if (ctx.guia !== 'GR-I' && !ctx.filtrosCapturados) {
    return <Filtros token={token} />;
  }

  const [preguntas, estructura, vigentes] = await Promise.all([
    obtenerPreguntas(ctx.questionnaireId),
    ctx.guia === 'GR-I' ? Promise.resolve([]) : obtenerEstructura(ctx.questionnaireId),
    respuestasVigentes(ctx.asignacionId),
  ]);

  let secciones: SeccionUI[];
  if (ctx.guia === 'GR-I') {
    secciones = (['I', 'II', 'III', 'IV'] as const).map((s) => ({
      id: s,
      titulo: TITULOS_GR1[s] ?? s,
      preguntas: preguntas
        .filter((p) => p.section === s)
        .map((p) => ({
          clave: `${s}:${p.item_number}`,
          seccion: s,
          numero: p.item_number,
          texto: p.text,
        })),
    }));
  } else {
    const noAplican = new Set<number>(
      estructura
        .filter(
          (e) =>
            (e.conditional === 'atiende_clientes' && !ctx.empleado.atiendeClientes) ||
            (e.conditional === 'supervisa_personal' && !ctx.empleado.supervisaPersonal),
        )
        .map((e) => e.item_number),
    );
    const dominioDe = new Map(estructura.map((e) => [e.item_number, e.domain ?? 'General']));
    const porDominio = new Map<string, SeccionUI>();
    for (const p of preguntas) {
      if (noAplican.has(p.item_number)) continue;
      const dominio = dominioDe.get(p.item_number) ?? 'General';
      let seccion = porDominio.get(dominio);
      if (!seccion) {
        seccion = { id: dominio, titulo: dominio, preguntas: [] };
        porDominio.set(dominio, seccion);
      }
      seccion.preguntas.push({
        clave: String(p.item_number),
        seccion: null,
        numero: p.item_number,
        texto: p.text,
      });
    }
    secciones = [...porDominio.values()];
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Cuestionario {ctx.guia}</h1>
        <p className="text-sm text-slate-600">
          {ctx.empresa.razonSocial} · Tus respuestas se guardan automáticamente.
        </p>
      </header>
      <Cuestionario
        token={token}
        guia={ctx.guia}
        secciones={secciones}
        respuestasIniciales={vigentes}
      />
    </div>
  );
}
