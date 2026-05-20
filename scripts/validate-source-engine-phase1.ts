import { runPhase1Examples } from '../lib/source-engine/examples.phase1'

const results = runPhase1Examples()
let failed = 0
for (const r of results) {
  const status = r.pass ? 'PASS' : 'FAIL'
  if (!r.pass) failed++
  console.log(`${status}  ${r.name}`)
}
if (failed > 0) {
  console.error(`\n${failed} phase-1 example(s) failed.`)
  process.exit(1)
}
console.log(`\nAll ${results.length} phase-1 examples passed.`)
