/**
 * Source Engine smoke validation.
 * Usage: npx tsx scripts/validate-source-engine.ts
 */
import { runAllExamples } from '../lib/source-engine/examples.runtime'

const results = runAllExamples()
let failed = 0
for (const r of results) {
  const status = r.pass ? 'PASS' : 'FAIL'
  console.log(`${status}  ${r.name}`)
  if (!r.pass) failed += 1
}
if (failed > 0) {
  console.error(`\n${failed} example(s) failed`)
  process.exit(1)
}
console.log(`\nAll ${results.length} source-engine examples passed.`)
