/**
 * Mensajes de error de los formularios del panel (auditoría v0).
 *
 * Las acciones redirigían con `?error=datos|crear|subida|archivo`, pero NINGUNA página
 * leía ese parámetro: si fallaba la subida del PDF de la política —una tarea normativa
 * clave— el formulario simplemente reaparecía y el admin creía que había publicado.
 * El fallo silencioso es el peor patrón posible para un usuario no técnico.
 */

const MENSAJES: Record<string, string> = {
  datos: 'Faltan datos o alguno no es válido. Revisa los campos marcados como obligatorios.',
  crear: 'No se pudo guardar. Intenta de nuevo; si el problema continúa, avisa a soporte.',
  subida: 'No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo.',
  archivo: 'El archivo debe ser un PDF de máximo 10 MB.',
  duplicado: 'Ya existe un registro con ese correo en esta empresa.',
};

export function ErrorFormulario({ codigo }: { codigo?: string }) {
  if (!codigo) return null;
  const mensaje = MENSAJES[codigo] ?? MENSAJES.crear;
  return (
    <p
      role="alert"
      data-testid="error-formulario"
      className="rounded-md border border-peligro-borde bg-peligro-fondo p-3 text-sm text-peligro-texto"
    >
      {mensaje}
    </p>
  );
}
