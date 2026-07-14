'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CampoTexto } from '@/components/ui/input';
import { clienteNavegador } from '@/lib/supabase-navegador';

interface Factor {
  id: string;
  status: string;
}

/**
 * Enrolamiento de MFA TOTP (Fase 2.5): opcional, pensado para cuentas de
 * admin/consultor — ven agregados de salud de cientos de personas (auditoría v0,
 * dimensión 6 [Alto]: "sin MFA"). Usa el MFA nativo de Supabase Auth; una vez
 * verificado el factor, el login exige el código (aal2) y el panel lo refuerza.
 */
export function ConfiguracionMfa() {
  const [factores, setFactores] = useState<Factor[] | null>(null);
  const [inscripcion, setInscripcion] = useState<{
    factorId: string;
    qr: string;
    secreto: string;
  } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await clienteNavegador().auth.mfa.listFactors();
    setFactores((data?.totp ?? []).map((f) => ({ id: f.id, status: f.status })));
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const inscribir = async () => {
    setOcupado(true);
    setError(null);
    const { data, error: e } = await clienteNavegador().auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Constata',
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
    setInscripcion(null);
    setCodigo('');
    setAviso('Listo: tu cuenta ahora pide el código de tu app al iniciar sesión.');
    await cargar();
  };

  const quitar = async (factorId: string) => {
    setOcupado(true);
    setError(null);
    const { error: e } = await clienteNavegador().auth.mfa.unenroll({ factorId });
    setOcupado(false);
    if (e) {
      setError('No se pudo desactivar. Vuelve a iniciar sesión con tu código e intenta de nuevo.');
      return;
    }
    setAviso('Verificación en dos pasos desactivada.');
    await cargar();
  };

  if (factores === null) {
    return <p className="text-sm text-texto-secundario">Cargando…</p>;
  }

  const verificado = factores.find((f) => f.status === 'verified');

  return (
    <div className="flex flex-col gap-4 text-sm">
      {aviso && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900"
        >
          {aviso}
        </p>
      )}
      {error && (
        <p role="alert" className="text-peligro">
          {error}
        </p>
      )}

      {verificado ? (
        <div className="flex flex-col gap-3">
          <p className="font-medium text-emerald-800" data-testid="mfa-activo">
            La verificación en dos pasos está activa en tu cuenta.
          </p>
          <Button
            variant="outline"
            cargando={ocupado}
            onClick={() => void quitar(verificado.id)}
            data-testid="mfa-desactivar"
          >
            Desactivar
          </Button>
        </div>
      ) : inscripcion ? (
        <form onSubmit={verificar} className="flex flex-col gap-4">
          <p className="text-texto-secundario">
            Escanea el código con tu app autenticadora (Google Authenticator, 1Password, Authy…) y
            escribe el código de 6 dígitos para confirmar.
          </p>
          {/* El QR llega como data URL (la CSP permite img-src data:); un <img> plano
              basta — next/image no aporta nada sobre un data URI. */}
          <img
            src={inscripcion.qr}
            alt="Código QR para tu app autenticadora"
            className="h-44 w-44"
          />
          <p className="text-xs text-texto-secundario">
            ¿No puedes escanear? Ingresa esta clave manualmente:{' '}
            <code className="font-mono">{inscripcion.secreto}</code>
          </p>
          <CampoTexto
            etiqueta="Código de 6 dígitos"
            nombre="codigo-totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={6}
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          <Button type="submit" cargando={ocupado} data-testid="mfa-confirmar">
            Confirmar y activar
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-texto-secundario">
            Con la verificación en dos pasos, iniciar sesión pide además un código de tu app
            autenticadora. Recomendada para cuentas que administran empresas: ven datos agregados de
            salud de toda la plantilla.
          </p>
          <Button cargando={ocupado} onClick={() => void inscribir()} data-testid="mfa-activar">
            Activar verificación en dos pasos
          </Button>
        </div>
      )}
    </div>
  );
}
