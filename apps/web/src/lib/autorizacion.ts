import { redirect } from 'next/navigation';
import { clienteSesion, usuarioActual } from './supabase-servidor';

// Autorización del panel. La membresía REAL (role_assignments / consultant_assignments)
// es la única fuente de verdad: los identificadores de empresa que llegan en la URL solo
// se usan DESPUÉS de verificar la membresía del usuario autenticado (regla inviolable 6).
// Fase 2.5: estas lecturas van con el CLIENTE DE SESIÓN (anon key + JWT), así que las
// políticas RLS de "fila propia" son una segunda verificación a nivel de base de datos.

export type RolPanel = 'admin_org' | 'consultor' | 'miembro';
export type EstadoEmpresa = 'active' | 'suspended' | 'pending_deletion';

export interface Membresia {
  companyId: string;
  razonSocial: string;
  rol: RolPanel;
  esResponsableDesignado: boolean;
  /** Estado del tenant (Fase 5): el panel muestra el aviso de suspensión y las acciones
   * mutantes cortan temprano con mensaje claro (en vez de un 42501 críptico de RLS). */
  empresaStatus: EstadoEmpresa;
}

interface EmpresaJoin {
  legal_name: string;
  status: EstadoEmpresa;
}

export async function membresiasDe(userId: string): Promise<Membresia[]> {
  const supabase = await clienteSesion();
  const [roles, consultorias] = await Promise.all([
    supabase
      .from('role_assignments')
      .select('company_id, role, is_designated_responsible, companies (legal_name, status)')
      .eq('auth_user_id', userId),
    supabase
      .from('consultant_assignments')
      .select('company_id, companies (legal_name, status)')
      .eq('consultant_user_id', userId),
  ]);

  const membresias: Membresia[] = [];
  for (const fila of roles.data ?? []) {
    const empresa = fila.companies as unknown as EmpresaJoin;
    membresias.push({
      companyId: fila.company_id,
      razonSocial: empresa.legal_name,
      rol: fila.role as RolPanel,
      esResponsableDesignado: fila.is_designated_responsible,
      empresaStatus: empresa.status,
    });
  }
  for (const fila of consultorias.data ?? []) {
    const empresa = fila.companies as unknown as EmpresaJoin;
    membresias.push({
      companyId: fila.company_id,
      razonSocial: empresa.legal_name,
      rol: 'consultor',
      esResponsableDesignado: false,
      empresaStatus: empresa.status,
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

export const MENSAJE_EMPRESA_NO_ACTIVA =
  'Tu cuenta está en modo solo lectura (suspendida o en baja): esta operación no está disponible. Tu evidencia histórica sigue disponible para consulta y descarga.';

/**
 * Corte temprano de capa app para acciones mutantes que corren con service_role
 * (Fase 5): distribución de cuestionarios, generación de informes, correos. Las
 * escrituras vía RLS ya mueren en BD (políticas RESTRICTIVE); estas no pasan por RLS y
 * este check es su única guardia. EXCEPCIÓN DOCUMENTADA: la canalización clínica del RD
 * (gr1_results) NO usa este check — la atención a la salud sobrevive a la suspensión.
 */
export function empresaOperable(membresia: Membresia): { ok: true } | { ok: false; error: string } {
  if (membresia.empresaStatus === 'active') return { ok: true };
  return { ok: false, error: MENSAJE_EMPRESA_NO_ACTIVA };
}
