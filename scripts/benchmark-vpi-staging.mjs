/**
 * Staging benchmark — vpi_load_dashboard() via authenticated Supabase client.
 *
 * Usage:
 *   npm run db:benchmark-vpi-staging
 *   npm run db:benchmark-vpi-staging -- --iterations 20
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * Uses synthetic.staff.a@vilo-os.staging (see provision-synthetic.mjs).
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles } from './lib/env.mjs'

const SYNTHETIC_EMAIL = 'synthetic.staff.a@vilo-os.staging'
const SYNTHETIC_PASSWORD = 'SyntheticViloOs!2026A'
const BUDGET_MS = 800
const DEFAULT_ITERATIONS = 15

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

async function main() {
  loadEnvFiles()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anon) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(1)
  }

  const iterations = Number(process.argv.find((a) => a.startsWith('--iterations='))?.split('=')[1])
    || DEFAULT_ITERATIONS

  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
    email: SYNTHETIC_EMAIL,
    password: SYNTHETIC_PASSWORD,
  })
  if (signInError) {
    console.error('Sign-in failed:', signInError.message)
    process.exit(1)
  }

  const userId = signIn.user?.id
  console.log(`Signed in as ${SYNTHETIC_EMAIL} (${userId})`)

  const timings = []
  let lastPayload = null
  let lastError = null

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    const { data, error } = await client.rpc('vpi_load_dashboard')
    const ms = performance.now() - t0
    timings.push(ms)
    if (error) {
      lastError = error
      console.error(`Iteration ${i + 1} RPC error:`, error.message)
    } else {
      lastPayload = data
    }
  }

  await client.auth.signOut()

  const sorted = [...timings].sort((a, b) => a - b)
  const p50 = percentile(sorted, 50)
  const p95 = percentile(sorted, 95)
  const max = sorted[sorted.length - 1] ?? 0
  const min = sorted[0] ?? 0

  const studyCount = Array.isArray(lastPayload?.study_health)
    ? lastPayload.study_health.length
    : 0
  const signalCount = Array.isArray(lastPayload?.subject_risk_signals)
    ? lastPayload.subject_risk_signals.length
    : 0
  const loadCount = Array.isArray(lastPayload?.coordinator_load)
    ? lastPayload.coordinator_load.length
    : 0

  const report = {
    runAt: new Date().toISOString(),
    iterations,
    budgetMs: BUDGET_MS,
    timingsMs: { min: Math.round(min), p50: Math.round(p50), p95: Math.round(p95), max: Math.round(max) },
    budgetMet: p95 < BUDGET_MS,
    rpcError: lastError?.message ?? null,
    payloadShape: lastPayload
      ? {
          study_health: studyCount,
          subject_risk_signals: signalCount,
          coordinator_load: loadCount,
          has_generated_at: Boolean(lastPayload.generated_at),
        }
      : null,
  }

  console.log(JSON.stringify(report, null, 2))

  if (lastError) process.exit(1)
  if (p95 >= BUDGET_MS) {
    console.error(`\nP95 ${Math.round(p95)}ms exceeds budget ${BUDGET_MS}ms`)
    process.exit(1)
  }
  console.log(`\nVPI RPC benchmark: P95 ${Math.round(p95)}ms < ${BUDGET_MS}ms`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
