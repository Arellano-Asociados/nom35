import type { Metadata } from 'next';
import { BuzonEmpleado } from '@/components/buzon/buzon-empleado';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ipCliente, permitido } from '@/lib/limites';
import { clienteAdmin } from '@/lib/supabase-admin';
import { hashDeToken } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Buzón de quejas' };

// Buzón de quejas (NOM-035 8.1 b): accesible SIN sesión con el token de la empresa.
// El flujo corre con service_role (como todo el lado del trabajador); el token es la
// capacidad y el anonimato es real: el enlace no identifica a ninguna persona.
export default async function PaginaBuzon({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: buzon } = await clienteAdmin()
    .from('complaint_boxes')
    .select('company_id, companies (legal_name)')
    .eq('token_hash', hashDeToken(token))
    .maybeSingle();

  if (!buzon) {
    const ip = await ipCliente();
    const dentroDelLimite = await permitido(`token-miss:${ip}`, {
      ventanaSegundos: 600,
      maximo: 30,
    });
    return (
      <Card>
        <CardHeader>
          <CardTitle>{dentroDelLimite ? 'Enlace inválido' : 'Demasiados intentos'}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-slate-700">
          {dentroDelLimite
            ? 'Este enlace no corresponde a ningún buzón. Verifica que lo hayas copiado completo o pide el enlace vigente en tu centro de trabajo.'
            : 'Recibimos demasiados intentos desde tu conexión. Espera unos minutos e intenta de nuevo.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <BuzonEmpleado
      token={token}
      razonSocial={(buzon.companies as unknown as { legal_name: string }).legal_name}
    />
  );
}
