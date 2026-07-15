import type { Metadata } from 'next';
import { AccesoAdmin } from '@/components/admin/acceso-admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Acceso de operación' };

export default function PaginaIngresarAdmin() {
  return <AccesoAdmin />;
}
