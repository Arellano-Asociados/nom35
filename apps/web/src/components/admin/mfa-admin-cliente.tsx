'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CampoTexto } from '@/components/ui/input';
import { clienteNavegador } from '@/lib/supabase-navegador';

// MFA del portal de plataforma (spec §1.4). A diferencia del panel, aquí el TOTP es
// OBLIGATORIO: no hay botón de "desactivar" ni camino a /admin sin aal2 fresco.

export function EnrolarMfaAdmin() {
  const router = useRouter();
  const [inscripcion, setInscripcion] = useState<{
    factorId: string;
    qr: string;
    secreto: string;
  } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const inscribir = async () => {
    setOcupado(true);
    setError(null);
    const { data, error: e } = await clienteNavegador().auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Constata Plataforma',
    });
    setOcupado(false);
    if (e || !data) {
      setError('No se pudo iniciar la activación. Intenta de nuevo.');
      return;
    }
    setInscripcion({ factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret });
  };

  const verificar = async (e: React.FormEvent) => {
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
    setOcupado(false);
    if (errorVerifica) {
      setError('Código incorrecto o vencido. Revisa tu app e intenta de nuevo.');
      return;
    }
    router.push('/admin');
    router.refresh();
  };

  if (!inscripcion) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-texto-secundario">
          Operar la plataforma exige verificación en dos pasos. Activa tu app autenticadora para
          continuar — no hay acceso sin ella.
        </p>
        {error && (
          <p role="alert" className="text-peligro">
            {error}
          </p>
        )}
        <Button cargando={ocupado} onClick={() => void inscribir()} data-testid="admin-mfa-activar">
          Activar verificación en dos pasos
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={verificar} className="flex flex-col gap-4 text-sm">
      <p className="text-texto-secundario">
        Escanea el código con tu app autenticadora y escribe el código de 6 dígitos.
      </p>
      {/* Data URL permitido por la CSP (img-src data:), igual que en el panel. */}
      <img src={inscripcion.qr} alt="Código QR para tu app autenticadora" className="h-44 w-44" />
      <p className="text-xs text-texto-secundario">
        ¿No puedes escanear? Clave manual: <code className="font-mono">{inscripcion.secreto}</code>
      </p>
      <CampoTexto
        etiqueta="Código de 6 dígitos"
        nombre="codigo-totp-admin"
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
      <Button type="submit" cargando={ocupado} data-testid="admin-mfa-confirmar">
        Confirmar y continuar
      </Button>
    </form>
  );
}

/** Re-verificación TOTP: sube a aal2 o refresca el timestamp AMR (ventana de 4h). */
export function VerificarMfaAdmin() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const verificar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    const supabase = clienteNavegador();
    const { data: factores } = await supabase.auth.mfa.listFactors();
    const totp = factores?.totp?.find((f) => f.status === 'verified');
    if (!totp) {
      setOcupado(false);
      setError('No encontramos tu factor. Inicia sesión de nuevo.');
      return;
    }
    const { data: reto, error: errorReto } = await supabase.auth.mfa.challenge({
      factorId: totp.id,
    });
    if (errorReto || !reto) {
      setOcupado(false);
      setError('No se pudo iniciar la verificación. Intenta de nuevo.');
      return;
    }
    const { error: errorVerifica } = await supabase.auth.mfa.verify({
      factorId: totp.id,
      challengeId: reto.id,
      code: codigo.trim(),
    });
    setOcupado(false);
    if (errorVerifica) {
      setError('Código incorrecto o vencido. Revisa tu app e intenta de nuevo.');
      return;
    }
    router.push('/admin');
    router.refresh();
  };

  return (
    <form onSubmit={verificar} className="flex flex-col gap-4 text-sm">
      <p className="text-texto-secundario">
        Por seguridad, confirma tu identidad con el código de tu app autenticadora (la sesión de
        operación exige un código fresco cada 4 horas).
      </p>
      <CampoTexto
        etiqueta="Código de 6 dígitos"
        nombre="codigo-verificar-admin"
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
      <Button type="submit" cargando={ocupado} data-testid="admin-mfa-verificar">
        Verificar
      </Button>
    </form>
  );
}
