// Bootstrap del PRIMER operador de plataforma (spec §1.2). Manual, una vez por entorno:
// no existe signup público para /admin, nunca. Los siguientes operadores se invitan
// desde /admin/operadores.
//
// Uso:
//   node scripts/crear-operador.mjs correo@dominio.mx "Contraseña-Larga-123!"
//
// Requiere SUPABASE_SERVICE_ROLE_KEY en el entorno (regla 9: jamás hardcodeada).
// Rechaza correr contra un proyecto que no luzca local, salvo OPERADOR_ALLOW=1
// (patrón demo:seed).
//
// El operador nace 'active' pero SIN factor TOTP: autorizarPlataforma() lo bloqueará en
// /admin/mfa/enrolar en su primer acceso — el enrolamiento sigue siendo obligatorio.

/* eslint-disable no-console -- CLI operativa: sin datos de trabajadores (regla 9 aplica a
   logs de la aplicación, no a la salida de esta herramienta). */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error(
    'Falta SUPABASE_SERVICE_ROLE_KEY en el entorno (lo imprime `pnpm exec supabase start`).',
  );
  process.exit(1);
}

const pareceLocal = /127\.0\.0\.1|localhost/.test(SUPABASE_URL);
if (!pareceLocal && process.env.OPERADOR_ALLOW !== '1') {
  console.error(
    `NEXT_PUBLIC_SUPABASE_URL (${SUPABASE_URL}) no luce local.\n` +
      'Crear un operador de plataforma en producción es un acto deliberado: define OPERADOR_ALLOW=1 explícitamente.',
  );
  process.exit(1);
}

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: node scripts/crear-operador.mjs <correo> <contraseña>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existente, error: errorBusqueda } = await supabase
  .from('platform_users')
  .select('id, status')
  .eq('email', email.toLowerCase())
  .maybeSingle();
if (errorBusqueda) {
  console.error(`No se pudo consultar platform_users: ${errorBusqueda.message}`);
  process.exit(1);
}
if (existente) {
  console.log(
    `Ya existe un operador con ese correo (status: ${existente.status}). Nada que hacer.`,
  );
  process.exit(0);
}

const { data: creado, error: errorAuth } = await supabase.auth.admin.createUser({
  email: email.toLowerCase(),
  password,
  email_confirm: true,
});
if (errorAuth || !creado.user) {
  console.error(`No se pudo crear la cuenta auth: ${errorAuth?.message ?? 'sin detalle'}`);
  process.exit(1);
}

const { data: fila, error: errorInsert } = await supabase
  .from('platform_users')
  .insert({
    auth_user_id: creado.user.id,
    email: email.toLowerCase(),
    status: 'active',
    activated_at: new Date().toISOString(),
    invited_by: null, // null = bootstrap
  })
  .select('id')
  .single();
if (errorInsert) {
  // El trigger de identidad dual pudo rechazarlo: no dejar la cuenta auth huérfana.
  await supabase.auth.admin.deleteUser(creado.user.id);
  console.error(
    `No se pudo dar de alta al operador (¿la cuenta pertenece a una empresa?): ${errorInsert.message}`,
  );
  process.exit(1);
}

const { error: errorEvento } = await supabase.from('platform_audit_log').insert({
  operator_id: fila.id,
  event_type: 'operador_creado_bootstrap',
  entity: 'platform_users',
  entity_id: fila.id,
  details: { email: email.toLowerCase() },
});
if (errorEvento) {
  console.error(`Operador creado pero SIN evento en bitácora: ${errorEvento.message}`);
  process.exit(1);
}

console.log(
  `Operador de plataforma creado: ${email.toLowerCase()} (platform_users.id ${fila.id}).`,
);
console.log('En su primer acceso a /admin se le exigirá enrolar TOTP (obligatorio).');
