import { headers } from 'next/headers';
import { clienteAdmin } from './supabase-admin';

/**
 * Limitador de tasa (Fase 2.5; auditoría v0: "fuerza bruta viable"). Contador de
 * ventana fija en BD vía `public.golpe_limite` (wrapper REST de `app.golpe_limite`,
 * solo service_role): sobrevive al modelo serverless.
 *
 * Modo de fallo POR ENDPOINT (mini-fase post-F5; un limitador caído estuvo enmascarado
 * como fail-open desde la Fase 2.5 y nadie lo notó):
 *
 *  - `alFallar: 'rechazar'` (fail-closed) donde el límite ES la protección — superficies
 *    PÚBLICAS/anónimas sin otra guardia: ARCO, envío de queja al buzón, consulta de
 *    folio, y los gates de adivinación de tokens (`token-miss`). Con el limitador caído,
 *    esas superficies se cierran en vez de quedar sin freno.
 *  - `alFallar: 'permitir'` (fail-open, default) donde el límite es idempotencia/anti
 *    doble-clic de usuarios YA autorizados (informes, difusión, distribución, crons —
 *    cuya idempotencia primaria es la bitácora) o donde bloquear interrumpiría al
 *    trabajador legítimo respondiendo sobre un token VÁLIDO (la capacidad ya es suya).
 *
 * El login/registro conservan además los límites nativos de GoTrue (config.toml).
 * El error va al log del servidor (jamás datos del usuario, regla inviolable 9).
 */
export async function permitido(
  clave: string,
  {
    ventanaSegundos,
    maximo,
    alFallar = 'permitir',
  }: { ventanaSegundos: number; maximo: number; alFallar?: 'permitir' | 'rechazar' },
): Promise<boolean> {
  const { data, error } = await clienteAdmin().rpc('golpe_limite', {
    p_clave: clave,
    p_ventana_segundos: ventanaSegundos,
    p_maximo: maximo,
  });
  if (error) {
    // eslint-disable-next-line no-console -- operativo: limitador caído, sin datos personales
    console.error(
      `Limitador de tasa no disponible (${alFallar === 'rechazar' ? 'fail-closed: se rechaza' : 'fail-open: se permite'}):`,
      error.message,
    );
    return alFallar !== 'rechazar';
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
