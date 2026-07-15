'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { accionActivarOperador } from '@/acciones/plataforma';
import { Button } from '@/components/ui/button';
import { CampoTexto } from '@/components/ui/input';
import { clienteNavegador } from '@/lib/supabase-navegador';

/**
 * Alta de un operador invitado (spec §1.2): fijar contraseña → enrolar y verificar TOTP
 * → transición a 'active'. El enrolamiento es PARTE del alta: sin factor verificado no
 * hay operador activo. La sesión llega en el fragmento de la URL del enlace de
 * invitación: se procesa aquí, en el cliente (el servidor no ve fragmentos).
 */
export function ActivarAdmin() {
  const router = useRouter();
  const [sesion, setSesion] = useState<'cargando' | 'con-sesion' | 'sin-sesion'>('cargando');
  const [paso, setPaso] = useState<'password' | 'enrolar' | 'codigo'>('password');

  useEffect(() => {
    void clienteNavegador()
      .auth.getSession()
      .then(({ data }) => setSesion(data.session ? 'con-sesion' : 'sin-sesion'));
  }, []);
  const [password, setPassword] = useState('');
  const [inscripcion, setInscripcion] = useState<{
    factorId: string;
    qr: string;
    secreto: string;
  } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const fijarPassword = async (e: React.FormEvent) => {
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
    setPaso('enrolar');
  };

  const inscribir = async () => {
    setOcupado(true);
    setError(null);
    const { data, error: e1 } = await clienteNavegador().auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Constata Plataforma',
    });
    setOcupado(false);
    if (e1 || !data) {
      setError('No se pudo iniciar la activación del segundo factor. Intenta de nuevo.');
      return;
    }
    setInscripcion({ factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret });
    setPaso('codigo');
  };

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inscripcion) return;
    setOcupado(true);
    setError(null);
    const supabase = clienteNavegador();
    const { data: reto, error: errorReto } = await supabase.auth.mfa.challenge({
      factorId: inscripcion.factorId,
    });
    if (errorReto || !reto) {
      setOcupado(false);
      setError('No se pudo verificar. Intenta de nuevo.');
      return;
    }
    const { error: errorVerifica } = await supabase.auth.mfa.verify({
      factorId: inscripcion.factorId,
      challengeId: reto.id,
      code: codigo.trim(),
    });
    if (errorVerifica) {
      setOcupado(false);
      setError('Código incorrecto o vencido. Revisa tu app e intenta de nuevo.');
      return;
    }
    const r = await accionActivarOperador();
    setOcupado(false);
    if (!r.ok) {
      setError(r.error ?? 'No se pudo activar tu cuenta.');
      return;
    }
    router.push('/admin');
    router.refresh();
  };

  if (sesion === 'cargando') {
    return <p className="text-sm text-texto-secundario">Verificando tu invitación…</p>;
  }
  if (sesion === 'sin-sesion') {
    return (
      <p className="text-sm text-texto-secundario" role="alert">
        Tu enlace de invitación no es válido o ya venció. Pide que te reenvíen la invitación desde
        el portal.
      </p>
    );
  }

  if (paso === 'password') {
    return (
      <form onSubmit={fijarPassword} className="flex flex-col gap-4 text-sm">
        <p className="text-texto-secundario">
          Define la contraseña de tu cuenta de operación. Después activarás tu app autenticadora —
          ambas cosas son obligatorias.
        </p>
        <CampoTexto
          etiqueta="Contraseña nueva"
          nombre="password-operador"
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
        <Button type="submit" cargando={ocupado} data-testid="activar-password">
          Guardar y continuar
        </Button>
      </form>
    );
  }

  if (paso === 'enrolar') {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-texto-secundario">
          Contraseña guardada. Ahora activa la verificación en dos pasos con tu app autenticadora
          (Google Authenticator, 1Password, Authy…).
        </p>
        {error && (
          <p role="alert" className="text-peligro">
            {error}
          </p>
        )}
        <Button cargando={ocupado} onClick={() => void inscribir()} data-testid="activar-mfa">
          Activar verificación en dos pasos
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={confirmar} className="flex flex-col gap-4 text-sm">
      <p className="text-texto-secundario">
        Escanea el código con tu app autenticadora y escribe el código de 6 dígitos para terminar tu
        alta.
      </p>
      {inscripcion && (
        <>
          <img
            src={inscripcion.qr}
            alt="Código QR para tu app autenticadora"
            className="h-44 w-44"
          />
          <p className="text-xs text-texto-secundario">
            ¿No puedes escanear? Clave manual:{' '}
            <code className="font-mono">{inscripcion.secreto}</code>
          </p>
        </>
      )}
      <CampoTexto
        etiqueta="Código de 6 dígitos"
        nombre="codigo-activar"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        minLength={6}
        maxLength={6}
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-peligro">
          {error}
        </p>
      )}
      <Button type="submit" cargando={ocupado} data-testid="activar-confirmar">
        Terminar alta
      </Button>
    </form>
  );
}
