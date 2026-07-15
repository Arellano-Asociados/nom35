import { contextoEncuesta, respuestasEncuesta } from '@/acciones/encuesta';
import { EncuestaCliente } from '@/components/cuestionarios/encuesta-cliente';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fechaEsMx } from '@/lib/fechas';
import { ipCliente, permitido } from '@/lib/limites';

export const dynamic = 'force-dynamic';

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

export default async function PaginaEncuesta({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await contextoEncuesta(token);

  if (!ctx) {
    // Misma defensa anti-adivinación que el flujo oficial (Fase 2.5).
    const ip = await ipCliente();
    const dentro = await permitido(`token-miss:${ip}`, { ventanaSegundos: 600, maximo: 30 });
    if (!dentro) {
      return (
        <Mensaje titulo="Demasiados intentos">
          Recibimos demasiados intentos desde tu conexión. Espera unos minutos e intenta con el
          enlace de tu correo.
        </Mensaje>
      );
    }
    return (
      <Mensaje titulo="Enlace inválido">
        Este enlace no corresponde a ningún cuestionario. Verifica que lo hayas copiado completo.
      </Mensaje>
    );
  }

  // Tenant no activo (Fase 5): sin capturas nuevas, pantalla neutra.
  if (!ctx.empresaActiva) {
    return (
      <Mensaje titulo="Cuestionario no disponible temporalmente">
        El cuestionario de tu centro de trabajo no está disponible por el momento. Consulta al
        responsable de tu centro de trabajo.
      </Mensaje>
    );
  }

  if (new Date(ctx.expiraEl).getTime() < Date.now()) {
    return (
      <Mensaje titulo="Enlace expirado">
        Este enlace venció el {fechaEsMx(ctx.expiraEl)}. Pide uno nuevo en tu centro de trabajo.
      </Mensaje>
    );
  }

  if (ctx.completado) {
    return (
      <Mensaje titulo="¡Gracias por responder!">
        <span data-testid="cp-confirmacion">
          Tus respuestas fueron enviadas. Ya puedes cerrar esta página.
        </span>
      </Mensaje>
    );
  }

  const vigentes = await respuestasEncuesta(ctx.asignacionId);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">{ctx.titulo}</h1>
        <p className="text-sm text-slate-600">
          Tus respuestas se guardan automáticamente. Fecha límite: {fechaEsMx(ctx.expiraEl)}.
        </p>
      </header>
      <EncuestaCliente token={token} definicion={ctx.definicion} respuestasIniciales={vigentes} />
    </div>
  );
}
