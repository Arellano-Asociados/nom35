'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { clienteNavegador } from '@/lib/supabase-navegador';

export default function PaginaIngresar() {
  const router = useRouter();
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  /** Traduce los códigos de Supabase Auth a mensajes en es-MX (no filtrar el inglés). */
  const mensajeDeError = (codigo: string | undefined, mensaje: string | undefined): string => {
    const texto = `${codigo ?? ''} ${mensaje ?? ''}`.toLowerCase();
    if (texto.includes('already registered') || texto.includes('user_already_exists')) {
      return 'Ya existe una cuenta con este correo. Usa “¿Ya tienes cuenta? Ingresa”.';
    }
    if (texto.includes('email not confirmed')) {
      return 'Tu cuenta aún no está confirmada. Abre el enlace que te enviamos por correo.';
    }
    if (texto.includes('password')) {
      return 'La contraseña debe tener al menos 12 caracteres e incluir mayúsculas, minúsculas, números y símbolos.';
    }
    if (texto.includes('invalid login credentials')) {
      return 'Correo o contraseña incorrectos.';
    }
    return modo === 'entrar'
      ? 'No pudimos iniciar sesión. Intenta de nuevo.'
      : 'No pudimos crear tu cuenta. Intenta de nuevo.';
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    setAviso(null);
    const supabase = clienteNavegador();
    const r =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setCargando(false);

    if (r.error) {
      setError(mensajeDeError(r.error.code, r.error.message));
      return;
    }

    // Con la confirmación de correo activada (endurecimiento de la auditoría v0), el
    // registro NO devuelve sesión: la cuenta queda inactiva hasta que la persona abra
    // el enlace que le llega por correo. Eso es lo que impide que un tercero reclame
    // el correo de un consultor ajeno.
    if (!r.data.session) {
      setAviso(
        'Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego ingresa con tu contraseña.',
      );
      return;
    }

    router.push('/panel');
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{modo === 'entrar' ? 'Ingresar al panel' : 'Crear cuenta'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Correo electrónico
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Contraseña
            <input
              type="password"
              required
              minLength={12}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          {aviso && (
            <p
              role="status"
              data-testid="aviso-confirmacion"
              className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"
            >
              {aviso}
            </p>
          )}
          <Button type="submit" disabled={cargando}>
            {cargando ? 'Un momento…' : modo === 'entrar' ? 'Ingresar' : 'Crear cuenta'}
          </Button>
          <button
            type="button"
            onClick={() => setModo(modo === 'entrar' ? 'registro' : 'entrar')}
            className="text-sm text-blue-700 underline"
          >
            {modo === 'entrar' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Ingresa'}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
