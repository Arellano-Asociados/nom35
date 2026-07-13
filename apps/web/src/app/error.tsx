'use client';

import { Button } from '@/components/ui/button';

// Sin este archivo, un error de servidor mostraba la pantalla por defecto de Next
// EN INGLÉS ("Application error: a client-side exception has occurred"). En un producto
// de cumplimiento legal, eso destruye la confianza justo en el peor momento.
export default function ErrorGlobal({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Algo salió mal de nuestro lado
      </h1>
      <p className="text-sm leading-relaxed text-slate-600">
        No pudimos completar la operación. No perdiste nada de lo que ya habías guardado. Intenta de
        nuevo; si el problema continúa, avisa a quien administra la plataforma en tu empresa.
      </p>
      <div className="flex justify-center gap-3">
        <Button onClick={reset}>Intentar de nuevo</Button>
      </div>
    </main>
  );
}
