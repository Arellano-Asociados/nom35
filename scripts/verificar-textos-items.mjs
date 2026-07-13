// Verifica que los 138 textos de `questions` en la BD coincidan CARÁCTER A CARÁCTER
// con la transcripción canónica de scripts/textos-oficiales.json (incluye los
// encabezados de bloque en instruccion_previa). Falla (exit != 0) si:
//   - el JSON de referencia no coincide con su propio sha256 (deriva del archivo),
//   - falta algún ítem o sobra alguno,
//   - algún texto o instrucción difiere en un solo carácter,
//   - algún texto sigue siendo placeholder ITEM_TEXT_PENDIENTE.
//
// AVISO DE HONESTIDAD: el JSON de referencia y la migración de textos salen de la
// MISMA transcripción (DOF contrastado contra el PDF de la STPS por el mismo
// proceso). Este script protege contra deriva o corrupción de la BD y del archivo,
// NO contra un error de transcripción de origen. La verificación independiente
// contra el DOF la debe firmar un consultor certificado NOM-035.
//
// Uso: node scripts/verificar-textos-items.mjs
// Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY;
//      questions es catálogo de lectura pública). Los imprime `pnpm exec supabase start`.

/* eslint-disable no-console -- herramienta de verificación: la salida es su interfaz
   (textos de catálogo normativo público, no respuestas ni resultados de trabajadores). */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const API_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!API_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.');
  process.exit(2);
}

const ref = JSON.parse(readFileSync(new URL('./textos-oficiales.json', import.meta.url), 'utf8'));

const errores = [];

// 1. Integridad del propio archivo de referencia
const shaCalculado = createHash('sha256').update(JSON.stringify(ref.guias), 'utf8').digest('hex');
if (shaCalculado !== ref.sha256_guias) {
  errores.push(
    `El sha256 de textos-oficiales.json no coincide: esperado ${ref.sha256_guias}, calculado ${shaCalculado}. El archivo fue modificado sin actualizar el hash.`,
  );
}

// 2. Leer la BD (PostgREST; sin dependencias)
async function leer(ruta) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: API_KEY, authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`GET ${ruta} → ${res.status}: ${await res.text()}`);
  return res.json();
}

const cuestionarios = await leer('questionnaires?select=id,code');
const codigoDe = new Map(cuestionarios.map((c) => [c.id, c.code]));
const preguntas = await leer(
  'questions?select=questionnaire_id,section,item_number,text,instruccion_previa&limit=1000',
);

// Índice BD: guia → clave "seccion:item" → fila
const bd = new Map();
for (const p of preguntas) {
  const guia = codigoDe.get(p.questionnaire_id) ?? '?';
  if (!bd.has(guia)) bd.set(guia, new Map());
  bd.get(guia).set(`${p.section ?? ''}:${p.item_number}`, p);
}

function comparar(guia, clave, etiqueta, esperadoTexto, esperadoInstruccion) {
  const fila = bd.get(guia)?.get(clave);
  if (!fila) {
    errores.push(`${etiqueta}: FALTA en la BD`);
    return;
  }
  if (fila.text !== esperadoTexto) {
    errores.push(
      `${etiqueta}: texto difiere.\n  BD : ${JSON.stringify(fila.text)}\n  Ref: ${JSON.stringify(esperadoTexto)}`,
    );
  }
  if ((fila.instruccion_previa ?? null) !== (esperadoInstruccion ?? null)) {
    errores.push(
      `${etiqueta}: instruccion_previa difiere.\n  BD : ${JSON.stringify(fila.instruccion_previa)}\n  Ref: ${JSON.stringify(esperadoInstruccion ?? null)}`,
    );
  }
}

// 3. GR-I por secciones
let esperados = 0;
for (const [seccion, datos] of Object.entries(ref.guias['GR-I'].secciones)) {
  datos.items.forEach((texto, i) => {
    esperados++;
    comparar(
      'GR-I',
      `${seccion}:${i + 1}`,
      `GR-I ${seccion}.${i + 1}`,
      texto,
      i === 0 ? datos.instruccion : null,
    );
  });
}

// 4. GR-II y GR-III con numeración corrida
for (const guia of ['GR-II', 'GR-III']) {
  const { items, instrucciones_previas: instr } = ref.guias[guia];
  for (const [n, texto] of Object.entries(items)) {
    esperados++;
    comparar(guia, `:${n}`, `${guia} ${n}`, texto, instr[n] ?? null);
  }
}

// 5. Conteo total y placeholders
if (preguntas.length !== esperados) {
  errores.push(`La BD tiene ${preguntas.length} preguntas; la referencia define ${esperados}.`);
}
const pendientes = preguntas.filter((p) => p.text.startsWith('ITEM_TEXT_PENDIENTE'));
for (const p of pendientes) {
  errores.push(
    `Placeholder sin reemplazar: ${codigoDe.get(p.questionnaire_id)} ${p.section ?? ''}:${p.item_number}`,
  );
}

if (errores.length > 0) {
  console.error(`✗ Verificación de textos oficiales: ${errores.length} error(es)\n`);
  for (const e of errores) console.error('- ' + e);
  // exitCode (no process.exit): deja cerrar los sockets de fetch limpiamente.
  process.exitCode = 1;
} else {
  console.log(
    `✓ ${esperados} ítems verificados carácter a carácter contra scripts/textos-oficiales.json (sha256 ${ref.sha256_guias.slice(0, 12)}…). Sin placeholders.`,
  );
  console.log(
    'Recordatorio: esta verificación protege contra deriva de la BD, no sustituye la revisión del consultor contra el DOF.',
  );
}
