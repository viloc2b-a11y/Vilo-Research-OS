/**
 * Phase 6 — Runtime integrity static audit (no DB required).
 * Run: npx tsx scripts/runtime-integrity-audit.ts [--fail-on-blocker]
 */
import path from 'node:path'
import { catalogSummary } from '../lib/runtime-integrity/detect/silent-mutation-catalog'
import {
  scanDirectoryForDirectMutations,
  summarizeDirectMutationFindings,
} from '../lib/runtime-integrity/detect/direct-mutation-scanner'
import { collectRegistryDrift, normalizeOperationalEventType } from '../lib/runtime-integrity/event-registry/normalize'
import { RPC_EMISSION_HARDENING_PLAN } from '../lib/runtime-integrity/integrity/rpc-emission-plan'

const failOnBlocker = process.argv.includes('--fail-on-blocker')
const root = path.resolve(import.meta.dirname, '..')

function main() {
  const findings = scanDirectoryForDirectMutations(root)
  const summary = summarizeDirectMutationFindings(findings)
  const blockers = findings.filter((f) => f.severity === 'blocker')
  const warnings = findings.filter((f) => f.severity === 'warning')

  const drift = collectRegistryDrift()
  const catalog = catalogSummary()

  console.log('=== Vilo OS Runtime Integrity Audit (Phase 6) ===\n')
  console.log(`Scanned: ${root}/lib`)
  console.log(`Direct mutation findings: ${summary.total} (${summary.blockers} blockers, ${summary.warnings} warnings)\n`)

  if (Object.keys(summary.byTable).length) {
    console.log('By clinical table:')
    for (const [table, count] of Object.entries(summary.byTable).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${table}: ${count}`)
    }
    console.log()
  }

  if (blockers.length) {
    console.log('--- Blockers (no emission hint, unapproved path) ---')
    for (const f of blockers.slice(0, 25)) {
      console.log(`  ${f.file}:${f.line}  ${f.table}.${f.operation}()`)
    }
    if (blockers.length > 25) console.log(`  ... +${blockers.length - 25} more`)
    console.log()
  }

  console.log('--- Event registry ---')
  console.log(`  Legacy aliases: ${drift.legacyAliases.length}`)
  console.log(`  Non-canonical registered: ${drift.nonCanonicalRegistered.join(', ') || 'none'}`)
  for (const legacy of drift.legacyAliases.slice(0, 3)) {
    const norm = normalizeOperationalEventType(legacy)
    console.log(`    ${legacy} → ${norm.canonical}`)
  }
  console.log()

  console.log('--- Silent mutation catalog ---')
  console.log(`  ${JSON.stringify(catalog)}`)
  console.log()

  console.log('--- RPC emission hardening (planned) ---')
  for (const item of RPC_EMISSION_HARDENING_PLAN.filter((r) => r.emitsOperationalEvent === false)) {
    console.log(`  [${item.priority}] ${item.rpcName}: ${item.notes}`)
  }
  console.log()

  if (failOnBlocker && summary.blockers > 0) {
    console.error(`FAILED: ${summary.blockers} blocker finding(s). Fix or approve paths.`)
    process.exit(1)
  }

  console.log('Audit complete.')
}

main()
