import type { NextConfig } from 'next';

// Cabeceras de seguridad ESTÁTICAS (auditoría v0: el archivo no definía ninguna).
//
// La Content-Security-Policy NO va aquí: necesita un nonce distinto por petición, así
// que se emite desde el middleware (`src/middleware.ts`).
//
// Sin X-Frame-Options/`frame-ancestors`, el panel era encuadrable → clickjacking sobre
// acciones sensibles ("Designarme Responsable Designado", "Distribuir cuestionarios").
const cabecerasSeguridad = [
  // 2 años, subdominios incluidos: la app maneja datos sensibles, no debe viajar en claro.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // El enlace tokenizado del empleado no debe filtrarse por Referer hacia terceros.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  // El motor se consume como TypeScript fuente desde el workspace
  transpilePackages: ['@nom35/motor-nom035'],
  async headers() {
    return [{ source: '/:path*', headers: cabecerasSeguridad }];
  },
};

export default nextConfig;
