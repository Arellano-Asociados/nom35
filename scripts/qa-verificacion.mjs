// Verificación AUTOMATIZABLE del manual de QA (docs/MANUAL_QA.md) contra el seed de demo
// (`pnpm seed:demo`). Afirma cada resultado esperado marcado "Auto"; sale con código ≠ 0 si
// alguno falla. Los renglones "Humana" NO se cubren aquí (requieren ojos en la UI).
//
// Uso: node scripts/qa-verificacion.mjs   (con Supabase local arriba y el seed aplicado)

/* eslint-disable no-console -- reporte de QA operativo. */

import pg from 'pg';

const DB = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const cliente = new pg.Client({ connectionString: DB });
await cliente.connect();

let fallos = 0;
async function afirmar(id, descripcion, fn) {
  try {
    const ok = await fn();
    console.log(`${ok ? '✓' : '✗'} ${id}  ${descripcion}`);
    if (!ok) fallos++;
  } catch (e) {
    console.log(`✗ ${id}  ${descripcion} — ${e.message}`);
    fallos++;
  }
}
const q = async (sql, params = []) => (await cliente.query(sql, params)).rows;
const uno = async (sql, params = []) => (await q(sql, params))[0];

const org1 = (await uno(`select id from companies where legal_name='Constata Demo, S.A. de C.V.'`))
  ?.id;
const org2 = (await uno(`select id from companies where legal_name='Aislamiento Demo, S. de R.L.'`))
  ?.id;
if (!org1 || !org2) {
  console.error('No encuentro las empresas del seed. ¿Corriste `pnpm seed:demo`?');
  process.exit(1);
}
const cicloCompleto = (
  await uno(
    `select id from compliance_cycles where company_id=$1 and name='Ciclo 2026 — Corporativo'`,
    [org1],
  )
)?.id;
const cicloCurso = (
  await uno(
    `select id from compliance_cycles where company_id=$1 and name='Ciclo 2026 — Monterrey'`,
    [org1],
  )
)?.id;

console.log('QA automatizable contra el seed de demo\n');

await afirmar('2.2', 'Semáforo global con los 5 niveles (≥3 c/u, sin suprimir)', async () => {
  const filas = await q(
    `select nivel_final, count(*)::int n from risk_results where cycle_id=$1 group by nivel_final`,
    [cicloCompleto],
  );
  const porNivel = Object.fromEntries(filas.map((f) => [f.nivel_final, f.n]));
  return ['nulo', 'bajo', 'medio', 'alto', 'muy_alto'].every((n) => (porNivel[n] ?? 0) >= 3);
});

await afirmar('3.1', 'Los 3 centros cubren las 3 categorías normativas', async () => {
  const cats = (
    await q(`select distinct nom_category from work_centers where company_id=$1`, [org1])
  )
    .map((r) => r.nom_category)
    .sort();
  return JSON.stringify(cats) === JSON.stringify(['gr1_gr2', 'gr1_gr3', 'solo_gr1']);
});

await afirmar('3.2', 'Padrón de 60+ empleados en Org 1', async () => {
  const { n } = await uno(`select count(*)::int n from employees where company_id=$1`, [org1]);
  return n >= 60;
});

await afirmar('4.1', 'Ciclo Corporativo cerrado con resultados; Monterrey abierto', async () => {
  const corp = await uno(`select date_end from compliance_cycles where id=$1`, [cicloCompleto]);
  const mty = await uno(`select date_end from compliance_cycles where id=$1`, [cicloCurso]);
  const { n } = await uno(`select count(*)::int n from risk_results where cycle_id=$1`, [
    cicloCompleto,
  ]);
  return corp.date_end !== null && mty.date_end === null && n >= 30;
});

await afirmar('4.2', 'Ciclo Monterrey en curso (~40%: entre 30% y 50% completado)', async () => {
  const { completados, total } = await uno(
    `select count(*) filter (where qa.completed_at is not null)::int completados, count(*)::int total
     from questionnaire_assignments qa join questionnaires q on q.id=qa.questionnaire_id
     where qa.cycle_id=$1 and q.code='GR-II'`,
    [cicloCurso],
  );
  const pct = total > 0 ? completados / total : 0;
  return pct >= 0.3 && pct <= 0.5;
});

await afirmar('8.1', 'Programa con acciones en ≥3 estados distintos', async () => {
  const { prog } = await uno(
    `select count(*)::int prog from intervention_programs where company_id=$1`,
    [org1],
  );
  const estados = (
    await q(
      `select distinct status from action_items where company_id=$1 and program_id is not null`,
      [org1],
    )
  ).map((r) => r.status);
  return prog >= 1 && estados.length >= 3;
});

await afirmar('9.1', 'Dos quejas en estados distintos (en_revision y cerrada)', async () => {
  const estados = (
    await q(`select status from complaints where company_id=$1 order by folio`, [org1])
  )
    .map((r) => r.status)
    .sort();
  return JSON.stringify(estados) === JSON.stringify(['cerrada', 'en_revision']);
});

await afirmar('10.1/10.2', 'Evento ATS con expuestos evaluados y una canalización', async () => {
  const { n } = await uno(`select count(*)::int n from traumatic_events where company_id=$1`, [
    org1,
  ]);
  const canal = await uno(
    `select count(*)::int n from gr1_results where company_id=$1 and canalizacion_estatus='canalizado'`,
    [org1],
  );
  return n >= 1 && canal.n >= 1;
});

await afirmar('11.1', 'Constancia de difusión publicada y sellada', async () => {
  const d = await uno(`select sha256 from dissemination_records where company_id=$1 limit 1`, [
    org1,
  ]);
  return !!d && typeof d.sha256 === 'string' && d.sha256.length > 0;
});

await afirmar('12.1', 'Cuestionario personalizado en estado publicado', async () => {
  const c = await uno(
    `select status from custom_questionnaires where company_id=$1 and title='Encuesta interna de clima (demo)'`,
    [org1],
  );
  return c?.status === 'publicado';
});

await afirmar('14.1', 'Dos borradores de IA: uno adoptado y uno sin adoptar', async () => {
  const adoptados = await uno(
    `select count(*)::int n from ai_drafts where company_id=$1 and adopted_at is not null`,
    [org1],
  );
  const sin = await uno(
    `select count(*)::int n from ai_drafts where company_id=$1 and adopted_at is null`,
    [org1],
  );
  const flag = await uno(
    `select enabled from feature_flags where company_id=$1 and flag='ia_asistida'`,
    [org1],
  );
  return adoptados.n >= 1 && sin.n >= 1 && flag?.enabled === true;
});

await afirmar('15.3', 'Ambas organizaciones existen y están activas', async () => {
  const c = await uno(
    `select count(*)::int n from companies where status='active' and legal_name in ('Constata Demo, S.A. de C.V.','Aislamiento Demo, S. de R.L.')`,
  );
  return c.n === 2;
});

await afirmar('16.1', 'Aislamiento: las membresías de las dos orgs son disjuntas', async () => {
  const compartidos = await uno(
    `select count(*)::int n from role_assignments a
     join role_assignments b on a.auth_user_id=b.auth_user_id and a.company_id<>b.company_id
     where a.company_id=$1 and b.company_id=$2`,
    [org1, org2],
  );
  return compartidos.n === 0;
});

await afirmar(
  '16.6',
  'Respuestas crudas: authenticated NO puede hacer SELECT sobre responses',
  async () => {
    // Simula un usuario autenticado (como la suite RLS) y espera privilegio denegado (42501).
    const admin = await uno(
      `select auth_user_id from role_assignments where company_id=$1 and role='admin_org' limit 1`,
      [org1],
    );
    await q('begin');
    try {
      await q(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ role: 'authenticated', sub: admin.auth_user_id, company_id: org1 }),
      ]);
      await q(`set local role authenticated`);
      let denegado = false;
      try {
        await q(`select count(*) from responses`);
      } catch (e) {
        denegado = e.code === '42501';
      }
      return denegado;
    } finally {
      await q('rollback');
    }
  },
);

console.log(
  `\n${fallos === 0 ? 'TODAS las verificaciones automatizables pasaron.' : `${fallos} verificación(es) fallaron.`}`,
);
await cliente.end();
process.exit(fallos === 0 ? 0 : 1);
