/**
 * Phase 7 (VPI) — consolidated static validator.
 *
 * Runs 7A + 7B + 7C + 7E validators (no DB required for green path).
 * Live 7B catalog checks run only when DATABASE_URL is set.
 *
 * Usage: npm run db:validate-phase7-vpi
 * Pair with: npx tsc --noEmit && npm run build
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = resolve(__dirname, '..')

const STEPS = [
  { phase: '7A', script: 'validate-phase7a-read-layer.mjs' },
  { phase: '7B', script: 'validate-phase7b-vpi-views.mjs' },
  { phase: '7C', script: 'validate-phase7c-scoring.mjs' },
  { phase: '7E', script: 'validate-phase7e-command-minimal.mjs' },
]

const summary = {
  runAt: new Date().toISOString(),
  phase: '7 (VPI consolidated)',
  steps: [],
  passed: true,
}

for (const step of STEPS) {
  const path = resolve(projectRoot, 'scripts', step.script)
  const result = spawnSync(process.execPath, [path], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const ok = result.status === 0
  summary.steps.push({
    phase: step.phase,
    script: step.script,
    status: ok ? 'PASS' : 'FAIL',
    exitCode: result.status ?? 1,
    stderr: (result.stderr || '').trim().slice(0, 500),
  })
  if (!ok) summary.passed = false
}

console.log(JSON.stringify(summary, null, 2))

if (!summary.passed) {
  console.error('\nPhase 7 VPI consolidated validator: one or more steps failed.')
  process.exit(1)
}

console.log(`\nPhase 7 VPI consolidated validator: all ${STEPS.length} steps passed.`)
