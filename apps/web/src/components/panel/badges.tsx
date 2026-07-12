/**
 * Badges de nivel de riesgo y de estado, compartidos por todo el panel.
 * Accesibilidad (regla de diseño M7): el color NUNCA es la única señal — el texto
 * (etiqueta en español) siempre acompaña al color. Las combinaciones bg-100/text-800
 * cumplen contraste AA.
 */

const ETIQUETA_NIVEL: Record<string, string> = {
  nulo: 'Nulo',
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  muy_alto: 'Muy alto',
};

const CLASE_NIVEL: Record<string, string> = {
  nulo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  bajo: 'bg-lime-100 text-lime-800 border-lime-200',
  medio: 'bg-amber-100 text-amber-800 border-amber-200',
  alto: 'bg-orange-100 text-orange-800 border-orange-200',
  muy_alto: 'bg-red-100 text-red-800 border-red-200',
};

const CLASE_BASE_BADGE =
  'inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium';

/** Badge de nivel de riesgo (Nulo/Bajo/Medio/Alto/Muy alto): texto + color. */
export function BadgeNivel({ nivel }: { nivel: string }) {
  const clase = CLASE_NIVEL[nivel] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  return <span className={`${CLASE_BASE_BADGE} ${clase}`}>{ETIQUETA_NIVEL[nivel] ?? nivel}</span>;
}

/**
 * Badge neutro para celdas suprimidas por anti-reidentificación (regla inviolable 3: n < 3).
 * Conserva el texto visible exacto que ya asertaba el E2E (contiene "<3") con estilo de
 * badge consistente, y un `title` que explica el porqué de la supresión.
 */
export function BadgeSuprimido({ texto }: { texto: string }) {
  return (
    <span
      className={`${CLASE_BASE_BADGE} border-slate-200 bg-slate-100 text-slate-500`}
      title="Menos de 3 personas: se oculta para proteger el anonimato"
    >
      {texto}
    </span>
  );
}

const ETIQUETA_ESTATUS_CANALIZACION: Record<string, string> = {
  pendiente: 'Pendiente',
  canalizado: 'Canalizado',
  atendido: 'Atendido',
};

const CLASE_ESTATUS_CANALIZACION: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-800 border-amber-200',
  canalizado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  atendido: 'bg-blue-100 text-blue-800 border-blue-200',
};

/** Badge de estatus de canalización GR-I: pendiente=amber, canalizado=emerald, atendido=blue. */
export function BadgeEstadoCanalizacion({ estatus }: { estatus: string }) {
  const clase =
    CLASE_ESTATUS_CANALIZACION[estatus] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`${CLASE_BASE_BADGE} ${clase}`}>
      {ETIQUETA_ESTATUS_CANALIZACION[estatus] ?? estatus}
    </span>
  );
}
