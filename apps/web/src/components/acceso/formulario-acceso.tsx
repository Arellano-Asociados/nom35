'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CampoTexto } from '@/components/ui/input';
import { clienteNavegador } from '@/lib/supabase-navegador';

/**
 * Formulario de acceso/registro (lógica intacta de la Fase 1.5: confirmación de
 * correo obligatoria, mensajes de Supabase traducidos a es-MX). Los labels, textos
 * de botón y data-testid son contrato de los E2E.
 */
export function FormularioAcceso() {
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
        <CardTitle as="h1">{modo === 'entrar' ? 'Ingresar al panel' : 'Crear cuenta'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="flex flex-col gap-4">
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
            minLength={12}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            ayuda={
              modo === 'registro'
                ? 'Mínimo 12 caracteres, con mayúsculas, minúsculas, números y símbolos.'
                : undefined
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-peligro">
              {error}
            </p>
          )}
          {aviso && (
            <p
              role="status"
              data-testid="aviso-confirmacion"
              className="rounded-md border border-marca-200 bg-marca-50 p-3 text-sm text-marca-900"
            >
              {aviso}
            </p>
          )}
          <Button type="submit" cargando={cargando}>
            {cargando ? 'Procesando…' : modo === 'entrar' ? 'Ingresar' : 'Crear cuenta'}
          </Button>
          <button
            type="button"
            onClick={() => setModo(modo === 'entrar' ? 'registro' : 'entrar')}
            className="text-sm text-marca-700 underline"
          >
            {modo === 'entrar' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Ingresa'}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
