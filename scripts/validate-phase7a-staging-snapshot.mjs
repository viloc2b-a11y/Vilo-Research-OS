/**
 * Phase 7A staging snapshot — authenticated RPC + row counts for synthetic user.
 *
 * Confirms vpi_load_dashboard returns expected keys and reports data volume
 * (empty vs populated) for go/no-go on 7E visual QA.
 *
 * Usage: npm run db:validate-phase7a-staging-snapshot
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles } from './lib/env.mjs'

const SYNTHETIC_EMAIL = 'synthetic.staff.a@vilo-os.staging'
const SYNTHETIC_PASSWORD = 'SyntheticViloOs!2026A'

const results = {
  runAt: new Date().toISOString(),
  phase: '7A-staging-snapshot',
  checks: [],
  summary: { passed: 0, failed: 0 },
}

function record(name, ok, detail = '') {
  results.checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail: String(detail) })
  if (ok) results.summary.passed++
  else results.summary.failed++
}

async function main() {
  loadEnvFiles()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anon) {
    record('supabase env', false, 'missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY')
    printAndExit()
  }

  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: signInError } = await client.auth.signInWithPassword({
    email: SYNTHETIC_EMAIL,
    password: SYNTHETIC_PASSWORD,
  })
  record('synthetic user sign-in', !signInError, signInError?.message ?? 'ok')

  if (signInError) {
    printAndExit()
  }

  const { data, error } = await client.rpc('vpi_load_dashboard')
  record('vpi_load_dashboard callable', !error, error?.message ?? 'ok')

  if (error) {
    await client.auth.signOut()
    printAndExit()
  }

  for (const key of ['study_health', 'subject_risk_signals', 'coordinator_load', 'generated_at']) {
    record(`payload key: ${key}`, Object.prototype.hasOwnProperty.call(data, key))
  }

  const studies = Array.isArray(data.study_health) ? data.study_health : []
  const signals = Array.isArray(data.subject_risk_signals) ? data.subject_risk_signals : []
  const load = Array.isArray(data.coordinator_load) ? data.coordinator_load : []

  results.dataVolume = {
    study_health_rows: studies.length,
    subject_risk_signals_rows: signals.length,
    coordinator_load_rows: load.length,
  }

  record('study_health is array', Array.isArray(data.study_health))
  record('subject_risk_signals is array', Array.isArray(data.subject_risk_signals))

  if (studies.length === 0) {
    record(
      'data present for 7E visual QA',
      false,
      'no studies in scope — seed studies/subjects/visits before visual review',
    )
  } else {
    record('data present for 7E visual QA', true, `${studies.length} studies`)
  }

  const { count: visitCount } = await client
    .from('visits')
    .select('id', { count: 'exact', head: true })

  results.dataVolume.visits_total_visible = visitCount ?? 0

  await client.auth.signOut()
  printAndExit()
}

function printAndExit() {
  console.log(JSON.stringify(results, null, 2))
  process.exit(results.summary.failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
