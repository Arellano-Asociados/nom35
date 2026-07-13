import type { Metadata } from 'next';
import { FormularioArco } from '@/components/arco/formulario-arco';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Tus derechos sobre tus datos',
};

// Canal de derechos ARCO (arts. 22-34 LFPDPPP) — no existía ninguno (auditoría v0).
// Es una página PÚBLICA a propósito: el titular es un trabajador que no tiene cuenta en
// la plataforma y debe poder ejercer sus derechos sin depender de que su patrón le abra
// una puerta.

export default function PaginaPrivacidad() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Tus derechos sobre tus datos</CardTitle>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Tus respuestas a los cuestionarios de la NOM-035 son datos personales sensibles. La ley
            te da derecho a saber qué se hace con ellos y a decidir sobre ellos.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-slate-700">
          <p>
            La empresa donde trabajas es la <strong>responsable</strong> de tus datos. Esta
            plataforma solo los procesa por encargo suyo, así que tu solicitud se la haremos llegar
            a ella y ella debe responderte.
          </p>
          <p>
            El plazo legal es de <strong>20 días hábiles</strong>. Ejercer tus derechos no tiene
            ningún costo, y nadie puede tomar represalias contra ti por hacerlo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enviar una solicitud</CardTitle>
        </CardHeader>
        <CardContent>
          <FormularioArco />
        </CardContent>
      </Card>
    </div>
  );
}
