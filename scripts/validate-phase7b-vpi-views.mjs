/**
 * Phase 7B — VPI SQL aggregation validator.
 *
 * Static: migration SQL, TS RPC layer, fallback mode, no chart libs.
 * Optional live (DATABASE_URL): catalog checks for views/RPC/column.
 *
 * Usage: npm run db:validate-phase7b-vpi-views
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const results = {
  runAt: new Date().toISOString(),
  phase: '7B',
  checks: [],
  summary: { passed: 0, failed: 0, skipped: 0 },
}

function record(name, status, detail = '') {
  results.checks.push({ name, status, detail: String(detail ?? '') })
  if (status === 'PASS') results.summary.passed++
  else if (status === 'FAIL') results.summary.failed++
  else results.summary.skipped++
}

function read(rel) {
  return readFileSync(join(projectRoot, rel), 'utf8')
}

function walkTsFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walkTsFiles(full, acc)
    else if (/\.(tsx?|jsx?)$/.test(name)) acc.push(full)
  }
  return acc
}

const migrationPath = 'supabase/migrations/0053_phase7b_vpi_sql_aggregation.sql'
record('migration file exists', existsSync(join(projectRoot, migrationPath)) ? 'PASS' : 'FAIL')

if (existsSync(join(projectRoot, migrationPath))) {
  const sql = read(migrationPath)
  record('view vpi_study_health_v1 in migration', /vpi_study_health_v1/.test(sql) ? 'PASS' : 'FAIL')
  record('view vpi_subject_risk_signals_v1 in migration', /vpi_subject_risk_signals_v1/.test(sql) ? 'PASS' : 'FAIL')
  record('view vpi_coordinator_load_v1 in migration', /vpi_coordinator_load_v1/.test(sql) ? 'PASS' : 'FAIL')
  record('RPC vpi_load_dashboard in migration', /function\s+public\.vpi_load_dashboard\s*\(\)/.test(sql) ? 'PASS' : 'FAIL')
  record('assigned_user_id column in migration', /assigned_user_id/.test(sql) ? 'PASS' : 'FAIL')
  record('created_by not dropped', /created_by/.test(sql) ? 'PASS' : 'FAIL')
  record('security_invoker on views', /security_invoker\s*=\s*true/.test(sql) ? 'PASS' : 'FAIL')
  record('user_organization_ids in RPC', /user_organization_ids\(\)/.test(sql) ? 'PASS' : 'FAIL')
}

const rpcTs = read('lib/performance/read-layer/rpc-dashboard.ts')
const aggregatorTs = read('lib/performance/read-layer/aggregator.ts')
const signalsTs = read('lib/performance/read-layer/build-from-signals.ts')

for (const key of ['study_health', 'subject_risk_signals', 'coordinator_load', 'generated_at']) {
  record(`TS RPC key: ${key}`, rpcTs.includes(`'${key}'`) ? 'PASS' : 'FAIL')
}

record('buildFromRpc module exists', existsSync(join(projectRoot, 'lib/performance/read-layer/build-from-rpc.ts')) ? 'PASS' : 'FAIL')
record('buildFromSignals fallback exists', /export\s+async\s+function\s+buildFromSignals/.test(signalsTs) ? 'PASS' : 'FAIL')
record('aggregator dual mode', aggregatorTs.includes("'rpc'") && aggregatorTs.includes("'fallback'") ? 'PASS' : 'FAIL')
record('VPI_USE_RPC flag', aggregatorTs.includes('VPI_USE_RPC') ? 'PASS' : 'FAIL')
record('RPC failure fallback', aggregatorTs.includes('falling back') ? 'PASS' : 'FAIL')
record('vpi_load_dashboard rpc call', read('lib/performance/read-layer/build-from-rpc.ts').includes("rpc('vpi_load_dashboard')") ? 'PASS' : 'FAIL')

const FORBIDDEN_CHART_LIBS = ['recharts', 'chart.js', 'react-chartjs-2', 'victory', 'nivo', '@visx/', 'echarts', 'plotly.js']
const perfFiles = walkTsFiles(join(projectRoot, 'app/(ops)/performance'))
let chartHit = false
for (const file of perfFiles) {
  const text = readFileSync(file, 'utf8')
  if (FORBIDDEN_CHART_LIBS.some((lib) => text.includes(lib))) {
    chartHit = true
    break
  }
}
record('no chart libraries in performance routes', chartHit ? 'FAIL' : 'PASS')

async function liveCatalogChecks() {
  loadEnvFiles()
  const url = process.env.DATABASE_URL_DIRECT?.trim() || process.env.DATABASE_URL?.trim()
  if (!url) {
    record('live catalog (DATABASE_URL)', 'SKIP', 'no DATABASE_URL')
    return
  }

  let sql
  try {
    sql = postgres(url, { ssl: 'require', max: 1, connect_timeout: 20 })
    await sql`select 1`
  } catch (e) {
    record('live catalog connect', 'SKIP', e.message)
    return
  }

  try {
    const views = await sql`
      select table_name
      from information_schema.views
      where table_schema = 'public'
        and table_name in (
          'vpi_study_health_v1',
          'vpi_subject_risk_signals_v1',
          'vpi_coordinator_load_v1'
        )
    `
    const migrateHint = 'apply supabase/migrations/0053_phase7b_vpi_sql_aggregation.sql (npm run db:migrate)'

    record(
      'live: 3 VPI views exist',
      views.length === 3 ? 'PASS' : 'SKIP',
      views.length === 3 ? 'ok' : `found=${views.length}; ${migrateHint}`,
    )

    const rpc = await sql`
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'vpi_load_dashboard'
    `
    record(
      'live: vpi_load_dashboard exists',
      rpc.length === 1 ? 'PASS' : 'SKIP',
      rpc.length === 1 ? 'ok' : migrateHint,
    )

    const col = await sql`
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'subject_workflow_actions'
        and column_name = 'assigned_user_id'
    `
    record(
      'live: assigned_user_id column',
      col.length === 1 ? 'PASS' : 'SKIP',
      col.length === 1 ? 'ok' : migrateHint,
    )
  } finally {
    await sql.end({ timeout: 5 })
  }
}

await liveCatalogChecks()

console.log(JSON.stringify(results, null, 2))

if (results.summary.failed > 0) {
  console.error(`\nPhase 7B validator: ${results.summary.failed} check(s) failed.`)
  process.exit(1)
}

console.log(
  `\nPhase 7B validator: ${results.summary.passed} passed, ${results.summary.skipped} skipped.`,
)
