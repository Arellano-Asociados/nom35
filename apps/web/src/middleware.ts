import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refresca la sesión de Supabase y protege /panel (roles administrativos con contraseña).
export async function middleware(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (nuevas) => {
          for (const { name, value } of nuevas) request.cookies.set(name, value);
          respuesta = NextResponse.next({ request });
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
  matcher: ['/panel/:path*', '/ingresar'],
};
