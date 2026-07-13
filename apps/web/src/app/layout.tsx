import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  // title.template: con varias pestañas abiertas cada página se distingue (WCAG 2.4.2;
  // hallazgo Medio de identidad de la auditoría v0).
  title: {
    default: 'Constata — Cumplimiento NOM-035',
    template: '%s · Constata',
  },
  description:
    'Constata: cumplimiento de la NOM-035-STPS-2018 con evidencia que resiste inspecciones.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={inter.variable}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
