import type { Metadata } from 'next';

// Fuera del grupo (centrado): el login usa layout dividido a pantalla completa
// (propuesta de valor + formulario). Render dinámico obligatorio por la CSP con
// nonce (auditoría v0): una página estática no puede llevar el nonce por petición.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Ingresar' };

export default function LayoutIngresar({ children }: { children: React.ReactNode }) {
  return children;
}
