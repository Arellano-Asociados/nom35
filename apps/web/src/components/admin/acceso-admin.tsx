'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CampoTexto } from '@/components/ui/input';
import { clienteNavegador } from '@/lib/supabase-navegador';

/**
 * Acceso al portal de plataforma (spec §1.2): contraseña + TOTP SIEMPRE — sin registro
 * público, sin magic link (para un alcance cross-tenant, un enlace en la bandeja es un
 * vector de robo de sesión demasiado barato). Los mensajes no distinguen "no existe" de
 * "contraseña incorrecta" ni revelan qué es /admin.
 */
export function AccesoAdmin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pideCodigo, setPideCodigo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const supabase = clienteNavegador();
    const { error: errorAcceso } = await supabase.auth.signInWithPassword({ email, password });
    if (errorAcceso) {
      setCargando(false);
      setError('Credenciales incorrectas.');
      return;
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setCargando(false);
    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      setPideCodigo(true);
      return;
    }
    // Sin factor TOTP: autorizarPlataforma() forzará el enrolamiento en /admin/mfa/enrolar.
    router.push('/admin');
    router.refresh();
  };

  const verificar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const supabase = clienteNavegador();
    const { data: factores } = await supabase.auth.mfa.listFactors();
    const totp = factores?.totp?.find((f) => f.status === 'verified');
    if (!totp) {
      setCargando(false);
      setError('No encontramos tu factor. Inicia sesión de nuevo.');
      return;
    }
    const { data: reto, error: errorReto } = await supabase.auth.mfa.challenge({
      factorId: totp.id,
    });
    if (errorReto || !reto) {
      setCargando(false);
      setError('No se pudo iniciar la verificación. Intenta de nuevo.');
      return;
    }
    const { error: errorVerifica } = await supabase.auth.mfa.verify({
      factorId: totp.id,
      challengeId: reto.id,
      code: codigo.trim(),
    });
    setCargando(false);
    if (errorVerifica) {
      setError('Código incorrecto o vencido. Revisa tu app e intenta de nuevo.');
      return;
    }
    router.push('/admin');
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">
          {pideCodigo ? 'Verificación en dos pasos' : 'Acceso de operación'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pideCodigo ? (
          <form onSubmit={verificar} className="flex flex-col gap-4">
            <CampoTexto
              etiqueta="Código de tu app autenticadora"
              nombre="codigo-mfa-admin"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-peligro">
                {error}
              </p>
            )}
            <Button type="submit" cargando={cargando} data-testid="admin-verificar-mfa">
              {cargando ? 'Procesando…' : 'Verificar'}
            </Button>
          </form>
        ) : (
          <form onSubmit={entrar} className="flex flex-col gap-4">
            <CampoTexto
              etiqueta="Correo electrónico"
              nombre="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <CampoTexto
              etiqueta="Contraseña"
              nombre="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-peligro">
                {error}
              </p>
            )}
            <Button type="submit" cargando={cargando} data-testid="admin-ingresar">
              {cargando ? 'Procesando…' : 'Ingresar'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
