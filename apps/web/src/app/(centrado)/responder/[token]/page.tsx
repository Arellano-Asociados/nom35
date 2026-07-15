import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { avisoVigenteDe } from '@/lib/aviso-privacidad';
import {
  difusionVigenteDe,
  obtenerContexto,
  obtenerEstructura,
  obtenerPreguntas,
  politicaPendienteDe,
  registrarConsultaResultadoPropio,
  respuestasVigentes,
  urlBuzonDe,
} from '@/lib/flujo';
import { fechaEsMx } from '@/lib/fechas';
import { ipCliente, permitido } from '@/lib/limites';
import { PoliticaPendiente } from '@/components/responder/politica';
import { AcusarDifusion } from '@/components/responder/difusion';
import { esResumenDifusion, ResumenDifusionVista } from '@/components/responder/resumen-difusion';
import { Consentimiento } from '@/components/responder/consentimiento';
import { Cuestionario, type SeccionUI } from '@/components/responder/cuestionario';
import { Filtros } from '@/components/responder/filtros';
import { Resultado } from '@/components/responder/resultado';

export const dynamic = 'force-dynamic';

// Títulos de sección literales del DOF 23-oct-2018 (Guía de Referencia I).
const TITULOS_GR1: Record<string, string> = {
  I: 'I.- Acontecimiento traumático severo',
  II: 'II.- Recuerdos persistentes sobre el acontecimiento (durante el último mes)',
  III: 'III.- Esfuerzo por evitar circunstancias parecidas o asociadas al acontecimiento (durante el último mes)',
  IV: 'IV.- Afectación (durante el último mes)',
};

/** Difusión del mecanismo de quejas (5.7 d): visible en el flujo del trabajador. */
function EnlaceBuzon({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <p className="text-sm text-slate-600">
      ¿Viviste o presenciaste malos tratos o violencia laboral? Repórtalo de forma segura y
      confidencial en el{' '}
      <a href={url} className="text-marca-700 underline" data-testid="enlace-buzon">
        buzón de quejas de tu empresa
      </a>
      .
    </p>
  );
}

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
    // Superficie de fuerza bruta de tokens (Fase 2.5): cada intento fallido cuenta
    // contra la IP; pasado el límite, ni siquiera se distingue "inválido" de nada.
    const ip = await ipCliente();
    const dentroDelLimite = await permitido(`token-miss:${ip}`, {
      ventanaSegundos: 600,
      maximo: 30,
      // fail-closed: este gate es el único freno a la adivinación de tokens.
      alFallar: 'rechazar',
    });
    if (!dentroDelLimite) {
      return (
        <Mensaje titulo="Demasiados intentos">
          Recibimos demasiados intentos desde tu conexión. Espera unos minutos e intenta de nuevo
          con el enlace de tu correo.
        </Mensaje>
      );
    }
    return (
      <Mensaje titulo="Enlace inválido">
        Este enlace no corresponde a ningún cuestionario. Verifica que lo hayas copiado completo o
        solicita uno nuevo a tu centro de trabajo.
      </Mensaje>
    );
  }

  // Tenant no activo (Fase 5): ni responder NI consultar resultados — la pantalla es
  // neutra a propósito (el trabajador no es parte del contrato en disputa) y no se
  // registra ninguna respuesta.
  if (!ctx.empresaActiva) {
    return (
      <Mensaje titulo="Cuestionario no disponible temporalmente">
        <span data-testid="empresa-no-activa">
          El cuestionario de tu centro de trabajo no está disponible por el momento. Consulta al
          responsable de tu centro de trabajo.
        </span>
      </Mensaje>
    );
  }

  // La expiración se evalúa ANTES que "completado" (corrección de la auditoría v0):
  // antes, un enlace ya usado seguía mostrando el resultado de salud del trabajador
  // PARA SIEMPRE, incluso vencido — y el enlace vive en un correo que el patrón
  // administra (buzón compartido, TI, historial de una máquina compartida). El dato
  // es sensible y su consulta no quedaba auditada, a diferencia del acceso del RD.
  if (ctx.expirado) {
    const urlBuzon = await urlBuzonDe(ctx.companyId);
    return (
      <div className="flex flex-col gap-4">
        <Mensaje titulo="Enlace expirado">
          <span data-testid="expirado">
            Este enlace ya no está vigente. Solicita uno nuevo al responsable de tu centro de
            trabajo.
          </span>
        </Mensaje>
        <EnlaceBuzon url={urlBuzon} />
      </div>
    );
  }

  if (ctx.completado) {
    const [politica, difusion, urlBuzon] = await Promise.all([
      politicaPendienteDe(ctx),
      // La constancia de difusión (5.7 e / 7.8) se muestra SOLO tras enviar el
      // cuestionario: ver resultados del grupo antes de responder sesgaría las
      // respuestas del instrumento.
      difusionVigenteDe(ctx),
      urlBuzonDe(ctx.companyId),
    ]);
    // Cada consulta del propio resultado deja rastro en la bitácora (regla 5: el acceso
    // a un resultado individual procesado siempre se audita, aunque sea el titular).
    await registrarConsultaResultadoPropio(ctx);
    return (
      <div className="flex flex-col gap-4">
        <div
          data-testid="confirmacion"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900 shadow-sm"
        >
          Tu cuestionario fue enviado. Gracias por tu participación. Mientras tu enlace siga vigente
          puedes volver a esta página para consultar tu resultado.
        </div>
        {politica && (
          <PoliticaPendiente
            token={token}
            policyId={politica.id}
            titulo={politica.titulo}
            version={politica.version}
            url={politica.url}
          />
        )}
        {difusion && esResumenDifusion(difusion.resumen) && (
          <div className="flex flex-col gap-3">
            <ResumenDifusionVista resumen={difusion.resumen} />
            <AcusarDifusion
              token={token}
              disseminationId={difusion.id}
              acusada={difusion.acusada}
            />
          </div>
        )}
        <Resultado asignacionId={ctx.asignacionId} guia={ctx.guia} />
        <EnlaceBuzon url={urlBuzon} />
      </div>
    );
  }

  if (!ctx.consentido) {
    // El aviso se lee ARCHIVADO de privacy_notices (se publica la plantilla base la
    // primera vez): así el consentimiento apunta a un texto verificable años después.
    const aviso = await avisoVigenteDe(ctx.companyId, ctx.empresa.razonSocial);
    return (
      <Consentimiento
        token={token}
        razonSocial={ctx.empresa.razonSocial}
        version={aviso.version}
        textoAviso={aviso.texto}
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
          instruccion: p.instruccion_previa,
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
        instruccion: p.instruccion_previa,
      });
    }
    secciones = [...porDominio.values()];
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        {/* Sin código interno (GR-*) frente al trabajador: fila 5 del copy de la
            auditoría v0. El código sigue disponible para soporte vía ctx.guia. */}
        <h1 className="text-xl font-semibold text-slate-900">
          Cuestionario sobre tu entorno de trabajo (NOM-035)
        </h1>
        <p className="text-sm text-slate-600">
          {ctx.empresa.razonSocial} · Tus respuestas se guardan automáticamente y son
          confidenciales: nadie de tu empresa puede verlas. Fecha límite: {fechaEsMx(ctx.expiraEl)}.
        </p>
        {ctx.guia !== 'GR-I' && (
          <p className="mt-1 text-sm text-slate-600">
            Al responder, considera las condiciones de tu trabajo durante los dos últimos meses. No
            hay respuestas correctas ni incorrectas.
          </p>
        )}
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
