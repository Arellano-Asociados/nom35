import Anthropic from '@anthropic-ai/sdk';

// Proveedor de IA detrás de una interfaz propia (patrón MailProvider de lib/correo.ts).
// La llamada SIEMPRE sale del servidor: ANTHROPIC_API_KEY solo en env del servidor, jamás
// NEXT_PUBLIC_*. Sin API key → ProveedorNulo (la UI desactiva la generación). En pruebas,
// IA_SIMULADA=1 → ProveedorSimulado (texto determinista, sin red).
//
// Anti prompt-injection: el insumo (JSON canónico ya suprimido) viaja como VALOR dentro de
// un bloque delimitado del mensaje de usuario; el system prompt (fijo en código) instruye
// tratar todo ese bloque como datos. Ninguna cadena del tenant se interpola en las
// instrucciones.

const MODELO_DEFAULT = 'claude-haiku-4-5-20251001';

export interface SolicitudIA {
  system: string; // constante de prompts.ts
  insumoJson: string; // JSON canónico (el mismo que se sella)
  maxTokens: number;
}

export interface RespuestaIA {
  texto: string;
  modelo: string; // el modelo REAL usado
}

export interface ProveedorIA {
  disponible(): boolean;
  generar(solicitud: SolicitudIA): Promise<RespuestaIA>;
}

function mensajeUsuario(insumoJson: string): string {
  return `Genera el borrador pedido a partir de estos datos agregados:\n<<<DATOS>>>\n${insumoJson}\n<<<FIN_DATOS>>>`;
}

class ProveedorAnthropic implements ProveedorIA {
  constructor(
    private readonly cliente: Anthropic,
    private readonly modelo: string,
  ) {}

  disponible(): boolean {
    return true;
  }

  async generar(solicitud: SolicitudIA): Promise<RespuestaIA> {
    const respuesta = await this.cliente.messages.create({
      model: this.modelo,
      max_tokens: solicitud.maxTokens,
      system: solicitud.system,
      messages: [{ role: 'user', content: mensajeUsuario(solicitud.insumoJson) }],
    });
    const texto = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return { texto, modelo: respuesta.model };
  }
}

/** Determinista, para pruebas: arma un texto VÁLIDO (pasa la validación) sin red. */
class ProveedorSimulado implements ProveedorIA {
  disponible(): boolean {
    return true;
  }

  async generar(solicitud: SolicitudIA): Promise<RespuestaIA> {
    const esPlan = solicitud.system.includes('PLAN DE ACCIÓN');
    const texto = esPlan
      ? '- [ancla: NINGUNA] Medida simulada para pruebas E2E.'
      : '## Panorama general\nParticipación simulada para pruebas.\n\n## Focos de atención\nSin focos reportables en el entorno de prueba.\n\n## Recomendación para la dirección\nMantener el seguimiento del ciclo.';
    return { texto, modelo: 'simulado' };
  }
}

class ProveedorNulo implements ProveedorIA {
  disponible(): boolean {
    return false;
  }

  async generar(): Promise<RespuestaIA> {
    throw new Error('La generación asistida por IA no está configurada en este entorno.');
  }
}

export function proveedorIA(): ProveedorIA {
  if (process.env.IA_SIMULADA === '1') return new ProveedorSimulado();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const modelo = process.env.IA_MODELO || MODELO_DEFAULT;
    return new ProveedorAnthropic(new Anthropic({ apiKey }), modelo);
  }
  return new ProveedorNulo();
}
