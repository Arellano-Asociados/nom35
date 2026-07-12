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
  const [cargando, setCargando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const supabase = clienteNavegador();
    let r =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    // Si el registro no devolvió sesión (p. ej. cuenta ya existente), intenta ingresar
    if (!r.error && !r.data.session && modo === 'registro') {
      r = await supabase.auth.signInWithPassword({ email, password });
    }
    setCargando(false);
    if (r.error || !r.data.session) {
      setError(
        modo === 'entrar'
          ? 'Correo o contraseña incorrectos'
          : `No se pudo crear la cuenta: ${r.error?.message ?? 'sin sesión'}`,
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
              minLength={8}
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
