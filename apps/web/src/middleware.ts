import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Dos responsabilidades:
//  1. Content-Security-Policy con NONCE por petición (auditoría v0). Next inyecta
//     scripts en línea para hidratar, así que una CSP con `script-src 'self'` a secas
//     rompe la app y una con 'unsafe-inline' no protege de nada. El nonce +
//     'strict-dynamic' es la forma correcta: solo se ejecuta el script que Next firmó
//     con el nonce de ESTA respuesta, y cualquier script inyectado por un XSS queda
//     bloqueado. El resto de cabeceras estáticas viven en next.config.ts.
//  2. Refresco de sesión de Supabase y protección de /panel (solo en esas rutas: no
//     tiene sentido pagar un getUser() en el flujo del empleado, que se autentica con
//     su token).

function construirCsp(nonce: string): string {
  const esDesarrollo = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    // 'strict-dynamic' hace que los scripts cargados por un script con nonce hereden
    // la confianza; 'unsafe-eval' solo en desarrollo (lo exige el refresco rápido).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${esDesarrollo ? " 'unsafe-eval'" : ''}`,
    // Tailwind inyecta estilos en línea; no hay forma de firmarlos con nonce hoy.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Supabase (API, Auth, Storage) es el único destino de red del cliente.
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:54321",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = construirCsp(nonce);

  // Next lee `x-nonce` de la petición y firma con él sus propios <script>.
  const encabezados = new Headers(request.headers);
  encabezados.set('x-nonce', nonce);
  encabezados.set('Content-Security-Policy', csp);

  let respuesta = NextResponse.next({ request: { headers: encabezados } });
  respuesta.headers.set('Content-Security-Policy', csp);

  // El flujo del empleado (/, /responder/…) no necesita sesión: su capacidad es el token.
  const esRutaDePanel =
    request.nextUrl.pathname.startsWith('/panel') || request.nextUrl.pathname === '/ingresar';
  if (!esRutaDePanel) return respuesta;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (nuevas) => {
          for (const { name, value } of nuevas) request.cookies.set(name, value);
          respuesta = NextResponse.next({ request: { headers: encabezados } });
          respuesta.headers.set('Content-Security-Policy', csp);
          for (const { name, value, options } of nuevas) {
            respuesta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith('/panel')) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/ingresar';
    return NextResponse.redirect(destino);
  }

  return respuesta;
}

export const config = {
  // La CSP debe cubrir TODA la app (incluido el flujo del empleado), así que el matcher
  // ya no se limita a /panel. Se excluyen los estáticos, que no ejecutan scripts.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
