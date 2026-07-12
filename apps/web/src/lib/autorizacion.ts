import { redirect } from 'next/navigation';
import { clienteAdmin } from './supabase-admin';
import { usuarioActual } from './supabase-servidor';

// Autorización del panel. La membresía REAL (role_assignments / consultant_assignments)
// es la única fuente de verdad: los identificadores de empresa que llegan en la URL solo
// se usan DESPUÉS de verificar la membresía del usuario autenticado (regla inviolable 6).

export type RolPanel = 'admin_org' | 'consultor' | 'miembro';

export interface Membresia {
  companyId: string;
  razonSocial: string;
  rol: RolPanel;
  esResponsableDesignado: boolean;
}

export async function membresiasDe(userId: string): Promise<Membresia[]> {
  const supabase = clienteAdmin();
  const [roles, consultorias] = await Promise.all([
    supabase
      .from('role_assignments')
      .select('company_id, role, is_designated_responsible, companies (legal_name)')
      .eq('auth_user_id', userId),
    supabase
      .from('consultant_assignments')
      .select('company_id, companies (legal_name)')
      .eq('consultant_user_id', userId),
  ]);

  const membresias: Membresia[] = [];
  for (const fila of roles.data ?? []) {
    membresias.push({
      companyId: fila.company_id,
      razonSocial: (fila.companies as unknown as { legal_name: string }).legal_name,
      rol: fila.role as RolPanel,
      esResponsableDesignado: fila.is_designated_responsible,
    });
  }
  for (const fila of consultorias.data ?? []) {
    membresias.push({
      companyId: fila.company_id,
      razonSocial: (fila.companies as unknown as { legal_name: string }).legal_name,
      rol: 'consultor',
      esResponsableDesignado: false,
    });
  }
  return membresias;
}

export interface AccesoEmpresa {
  userId: string;
  email: string;
  membresia: Membresia;
}

/** Redirige a /ingresar sin sesión y a /panel si el usuario no es miembro de la empresa. */
export async function autorizarEmpresa(companyId: string): Promise<AccesoEmpresa> {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/ingresar');
  const membresias = await membresiasDe(usuario.id);
  const membresia = membresias.find((m) => m.companyId === companyId);
  if (!membresia) redirect('/panel');
  return { userId: usuario.id, email: usuario.email ?? '', membresia };
}

/** Los roles que operan el panel (gestión). El rol 'miembro' solo porta el flag de RD. */
export function puedeGestionar(membresia: Membresia): boolean {
  return membresia.rol === 'admin_org' || membresia.rol === 'consultor';
}
