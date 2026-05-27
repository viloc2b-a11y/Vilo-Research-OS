/**
 * Phase P3 smoke: protocol runtime generation (reconciliation → study runtime composition).
 *
 * Usage:
 *   npx tsx scripts/protocol-runtime-generation-phaseP3-smoke.ts
 *   npx tsx scripts/protocol-runtime-generation-phaseP3-smoke.ts --live
 */
import { createClient } from '@supabase/supabase-js'
import { validateRuntimeGenerationReadiness } from '../lib/protocol-runtime-generation/validate-runtime-generation-readiness'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runUnitChecks() {
  console.log('--- Phase P3 unit checks ---')
  // Pure unit coverage is intentionally light; generation flow is integration-heavy.
  assert(typeof validateRuntimeGenerationReadiness === 'function', 'validateRuntimeGenerationReadiness exported')
  console.log('✅ Runtime generation module loads')
}

async function runLiveChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⏭️  Skipping live checks (Supabase env not set)')
    return
  }

  console.log('--- Phase P3 live integration ---')
  const supabase = createClient(url, key)

  // Surface-level checks: tables exist.
  const tables = ['protocol_runtime_generation_runs', 'protocol_runtime_generation_events'] as const
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1)
    if (error) throw new Error(`${table}: ${error.message}`)
  }

  console.log('✅ Generation tables reachable (full generation requires seeded approved reconciliation + study linkage)')
}

async function main() {
  runUnitChecks()
  if (LIVE) await runLiveChecks()
  console.log('------------------------------------------------------------')
  console.log('Phase P3 protocol runtime generation smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})

