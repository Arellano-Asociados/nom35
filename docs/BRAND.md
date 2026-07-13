# Constata — Manual de identidad

Decisiones tomadas el 2026-07-13 (Fase 2, con elección explícita del propietario del
producto). Cierra el hallazgo crítico C-09 y los hallazgos de la dimensión 3 de
`docs/AUDITORIA.md`.

## 1. Nombre

**Constata** — del verbo _constatar_: comprobar un hecho **y dejar constancia de él**.

Por qué funciona:

- Es el diferenciador central del producto dicho en una palabra: evidencia inmutable,
  auditable y exhibible ante la STPS. La plataforma no solo "gestiona" el cumplimiento:
  lo constata.
- Palabra española real con uso de marca casi nulo → registrable ante el IMPI; dominio
  plausible (constata.mx).
- No se encierra en la NOM-035: si el producto crece a otras obligaciones (NOM-030,
  etc.), el nombre sigue siendo verdadero.
- El nombre anterior ("Plataforma NOM-035") era un descriptor de categoría: genérico,
  indefendible como marca y compartible por cualquier competidor (hallazgo C-09).

**Descriptor** (siempre que el contexto no lo dé): _Cumplimiento NOM-035 con evidencia
que resiste inspecciones._

Alternativas evaluadas y descartadas: _Entorno35_ (cálido, pero atado a una sola norma
y de registro débil) y _Cauce_ (memorable, pero comunica poco la categoría).

## 2. Logotipo

- **Isotipo:** palomita que remata sobre una línea base, dentro de un sello redondeado
  azul profundo. Lectura: verificar (palomita) y dejar constancia (línea base, como la
  firma bajo un documento). Vive en `apps/web/src/components/marca/logo.tsx`
  (`IsotipoConstata`) y como favicon en `apps/web/src/app/icon.svg` (mismo dibujo).
- **Logotipo completo:** isotipo + wordmark "Constata" en Inter SemiBold, tracking
  apretado (`LogoConstata`). Variante `claro` para fondos de marca.
- **Área de respeto:** medio isotipo a cada lado. **Tamaño mínimo:** isotipo 16 px.
- **No hacer:** no recolorear el isotipo fuera de marca-700/blanco; no deformar; no
  usar el wordmark sin tracking apretado; no volver al favicon de Next.js.

## 3. Paleta

Los valores canónicos viven como design tokens en
`apps/web/src/app/globals.css` (`@theme`); este documento explica la intención.

### Primario — azul profundo («marca»)

Confianza institucional y seriedad legal, sin competir con el semáforo de la norma.

| Token       | Hex       | Uso                                                     |
| ----------- | --------- | ------------------------------------------------------- |
| `marca-50`  | `#eef2fb` | Fondos de énfasis suave (item activo del sidebar)       |
| `marca-100` | `#dfe7f7` | Fondos hover de superficies de marca                    |
| `marca-200` | `#c3d1ef` | Bordes de énfasis                                       |
| `marca-300` | `#9db3e3` | Decorativo sobre fondos oscuros                         |
| `marca-500` | `#4b69c2` | Anillo de foco (≥3:1 sobre blanco, WCAG 2.4.13)         |
| `marca-600` | `#3550ae` | Hover del botón primario · enlaces (7.3:1 sobre blanco) |
| `marca-700` | `#2b4193` | **Primario**: botones, isotipo (9.2:1 sobre blanco)     |
| `marca-800` | `#253677` | Estados presionados                                     |
| `marca-900` | `#1f2c5e` | Fondo del panel izquierdo del login                     |
| `marca-950` | `#141c3f` | Fondo de marca más profundo                             |

Texto blanco sobre `marca-600`–`950`: AA (≥7:1). Texto `marca-600`+ sobre blanco: AA.

### Semáforo de la norma (semánticos de nivel de riesgo)

Un token por nivel del semáforo NOM-035 (regla de niveles compartida del motor). El
color **nunca** es la única señal: siempre acompaña la etiqueta en texto.

| Nivel    | Token base       | Fondo claro (badge)           | Sobre fondo oscuro |
| -------- | ---------------- | ----------------------------- | ------------------ |
| Nulo     | `nivel-nulo`     | `emerald-100` / `emerald-800` | `emerald-300`      |
| Bajo     | `nivel-bajo`     | `lime-100` / `lime-800`       | `lime-300`         |
| Medio    | `nivel-medio`    | `amber-100` / `amber-800`     | `amber-300`        |
| Alto     | `nivel-alto`     | `orange-100` / `orange-800`   | `orange-300`       |
| Muy alto | `nivel-muy-alto` | `red-100` / `red-800`         | `red-300`          |

Las combinaciones fondo-100/texto-800 miden 6.36–8.08:1 (verificadas en la auditoría
v0, §8) — AA en fondo claro. Las variantes `-300` sobre `marca-900`/`slate-900` miden
≥7:1 — AA en fondo oscuro (correo/PDF en modo oscuro futuro).

### Neutrales y semánticos de interfaz

Escala `slate` de Tailwind con alias semánticos (tokens): `superficie` (blanco),
`fondo` (slate-50), `borde` (slate-200 decorativo / slate-400 en controles — mínimo
3:1), `texto` (slate-900), `texto-secundario` (slate-600, 7:1), `peligro` (red-700),
`exito` (emerald-700).

## 4. Tipografía

- **Inter** (ya cargada vía `next/font`), única familia. Fallbacks del sistema.
- Jerarquía: título de página `text-2xl font-semibold tracking-tight`; título de
  sección/card `text-lg font-semibold`; cuerpo `text-sm`; metadatos `text-xs`.
- Números tabulares (`tabular-nums`) en toda columna numérica y conteos.
- Sentence case en todo (ya era convención); nunca mayúsculas sostenidas salvo
  etiquetas de tabla (`uppercase tracking-wide text-xs`).

## 5. Tono de voz

Es-MX, tuteo, directo y sin alarmismo. Reglas (cierran la dimensión 2 de la auditoría):

1. **La consecuencia antes que la cita normativa.** "El centro no se ha evaluado en
   más de 24 meses: la norma exige una nueva evaluación", no "Atención (numeral 7.9)".
2. **Cero jerga interna en la superficie.** GR-I/GR-II/GR-III, Cfinal, "ítem",
   "canalización" se traducen: "cuestionario sobre tu entorno de trabajo",
   "calificación final", "pregunta", "requiere valoración clínica". El código interno
   puede ir entre paréntesis cuando el usuario experto lo necesita (panel), nunca en
   el flujo del trabajador ni en asuntos de correo.
3. **Los errores orientan el siguiente paso.** Qué pasó + qué hacer: "No se pudo subir
   el archivo. Revisa tu conexión e intenta de nuevo." Nunca el error crudo de la
   infraestructura, nunca en inglés.
4. **Al trabajador: confidencialidad explícita y calma.** Recordar siempre que nadie
   de su empresa ve sus respuestas; "esto no es un diagnóstico".
5. **Al administrador: evidencia y verbos de registro.** "Publicar", "constatar",
   "expediente", "acuse" — el vocabulario del valor del producto.
6. Verbo de espera unificado: **"Procesando…"**.

## 6. Correo

Remitente: `Constata <avisos@...>` — `MAIL_FROM` es obligatorio en producción; en
desarrollo el fallback es explícitamente local. Plantilla con isotipo, botón CTA
táctil y pie con el nombre del producto. Jamás datos sensibles (regla del proyecto).
