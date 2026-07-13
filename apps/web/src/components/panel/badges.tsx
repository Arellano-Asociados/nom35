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

// Tokens del semáforo (globals.css / docs/BRAND.md): un triple por nivel.
const CLASE_NIVEL: Record<string, string> = {
  nulo: 'bg-nivel-nulo-fondo text-nivel-nulo-texto border-nivel-nulo-borde',
  bajo: 'bg-nivel-bajo-fondo text-nivel-bajo-texto border-nivel-bajo-borde',
  medio: 'bg-nivel-medio-fondo text-nivel-medio-texto border-nivel-medio-borde',
  alto: 'bg-nivel-alto-fondo text-nivel-alto-texto border-nivel-alto-borde',
  muy_alto: 'bg-nivel-muy-alto-fondo text-nivel-muy-alto-texto border-nivel-muy-alto-borde',
};

const CLASE_BASE_BADGE =
  'inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium';

/** Badge de nivel de riesgo (Nulo/Bajo/Medio/Alto/Muy alto): texto + color. */
export function BadgeNivel({ nivel, className }: { nivel: string; className?: string }) {
  const clase = CLASE_NIVEL[nivel] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`${CLASE_BASE_BADGE} ${clase} ${className ?? ''}`}>
      {ETIQUETA_NIVEL[nivel] ?? nivel}
    </span>
  );
}

/**
 * Badge neutro para celdas suprimidas por anti-reidentificación (regla inviolable 3: n < 3).
 * Conserva el texto visible exacto que ya asertaba el E2E (contiene "<3") con estilo de
 * badge consistente, y un `title` que explica el porqué de la supresión.
 */
export function BadgeSuprimido({ texto }: { texto: string }) {
  return (
    <span
      className={`${CLASE_BASE_BADGE} border-slate-200 bg-slate-100 text-slate-700`}
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
  atendido: 'bg-marca-100 text-marca-800 border-marca-200',
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
