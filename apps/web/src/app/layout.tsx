import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plataforma NOM-035',
  description: 'Cumplimiento de la NOM-035-STPS-2018: factores de riesgo psicosocial en el trabajo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen antialiased">
        <main className="mx-auto w-full max-w-2xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
