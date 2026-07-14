import { headers } from 'next/headers';
import { clienteAdmin } from './supabase-admin';

/**
 * Limitador de tasa (Fase 2.5; auditoría v0: "fuerza bruta viable"). Contador de
 * ventana fija en BD vía `app.golpe_limite` (solo service_role): sobrevive al
 * modelo serverless. FAIL-OPEN deliberado: si el limitador falla, la operación se
 * permite — un limitador caído no debe tirar el producto; el error va al log del
 * servidor (jamás datos del usuario, regla inviolable 9).
 */
export async function permitido(
  clave: string,
  { ventanaSegundos, maximo }: { ventanaSegundos: number; maximo: number },
): Promise<boolean> {
  const { data, error } = await clienteAdmin().rpc('golpe_limite', {
    p_clave: clave,
    p_ventana_segundos: ventanaSegundos,
    p_maximo: maximo,
  });
  if (error) {
    // eslint-disable-next-line no-console -- operativo: limitador caído, sin datos personales
    console.error('Limitador de tasa no disponible (fail-open):', error.message);
    return true;
  }
  return data === true;
}

/**
 * IP del cliente para claves de límite. `x-forwarded-for` es falsificable (ya
 * documentado en la auditoría): sirve para frenar fuerza bruta simple, no como
 * evidencia. Tras el proxy de la plataforma (Vercel), el primer valor es el real.
 */
export async function ipCliente(): Promise<string> {
  const encabezados = await headers();
  const xff = encabezados.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || 'desconocida';
}
