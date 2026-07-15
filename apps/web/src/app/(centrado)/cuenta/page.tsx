import type { Metadata } from 'next';
import { DefinirPassword } from '@/components/acceso/definir-password';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Activa tu cuenta' };

// Sin chequeo de sesión del lado servidor A PROPÓSITO: la sesión del enlace de
// invitación llega en el fragmento de la URL, que el servidor jamás ve. El componente
// cliente la procesa y decide.
export default function PaginaCuenta() {
  return <DefinirPassword />;
}
