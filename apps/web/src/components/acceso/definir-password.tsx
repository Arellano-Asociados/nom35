'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CampoTexto } from '@/components/ui/input';
import { clienteNavegador } from '@/lib/supabase-navegador';

/**
 * Destino del enlace de invitación de un administrador de organización (alta operada
 * por plataforma, Fase 5). El enlace de Supabase trae la sesión en el fragmento de la
 * URL: este componente debe montarse ANTES de decidir si hay sesión (el servidor no ve
 * el fragmento), fijar la contraseña y mandar al panel.
 */
export function DefinirPassword() {
  const router = useRouter();
  const [sesion, setSesion] = useState<'cargando' | 'con-sesion' | 'sin-sesion'>('cargando');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    // clienteNavegador procesa el fragmento (#access_token=…) al inicializarse y deja
    // la sesión en cookies; getSession espera a que esa inicialización termine.
    void clienteNavegador()
      .auth.getSession()
      .then(({ data }) => setSesion(data.session ? 'con-sesion' : 'sin-sesion'));
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    const { error: e1 } = await clienteNavegador().auth.updateUser({ password });
    setOcupado(false);
    if (e1) {
      setError(
        'No se pudo guardar la contraseña: usa al menos 12 caracteres con mayúsculas, minúsculas, números y símbolos.',
      );
      return;
    }
    router.push('/panel');
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Activa tu cuenta</CardTitle>
      </CardHeader>
      <CardContent>
        {sesion === 'cargando' ? (
          <p className="text-sm text-texto-secundario">Verificando tu invitación…</p>
        ) : sesion === 'sin-sesion' ? (
          <p className="text-sm text-texto-secundario" role="alert">
            Tu enlace de invitación no es válido o ya venció. Pide a quien te invitó que reenvíe la
            invitación.
          </p>
        ) : (
          <form onSubmit={guardar} className="flex flex-col gap-4 text-sm">
            <p className="text-texto-secundario">
              Define la contraseña con la que entrarás al panel de tu organización.
            </p>
            <CampoTexto
              etiqueta="Contraseña nueva"
              nombre="password-cuenta"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              ayuda="Mínimo 12 caracteres, con mayúsculas, minúsculas, números y símbolos."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-peligro">
                {error}
              </p>
            )}
            <Button type="submit" cargando={ocupado} data-testid="cuenta-guardar-password">
              Guardar y entrar al panel
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
