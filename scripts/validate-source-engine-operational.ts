import { runOperationalSmokeTests } from '../lib/source-engine/operational/smoke-tests'

async function main() {
  const results = await runOperationalSmokeTests()
  let failed = 0

  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL'
    if (!r.pass) failed++
    const detail = r.detail ? ` — ${r.detail}` : ''
    console.log(`${status}  ${r.name}${detail}`)
  }

  if (failed > 0) {
    console.error(`\n${failed} operational smoke test(s) failed.`)
    process.exit(1)
  }

  console.log(`\nAll ${results.length} Source Engine operational smoke tests passed.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
