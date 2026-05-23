import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function gate(name: string, pass: boolean, detail: string = '') {
  return { name, pass, detail }
}

async function main() {
  const gates: ReturnType<typeof gate>[] = []

  // Check 1: signProcedure.ts has OCC guard
  const signProcPath = join(ROOT, 'lib', 'visit-runtime', 'signProcedure.ts')
  if (existsSync(signProcPath)) {
    const content = readFileSync(signProcPath, 'utf8')
    gates.push(gate('signProcedure has OCC guard', content.includes('expectedUpdatedAt') && content.includes('updated_at !== params.expectedUpdatedAt'), ''))
  } else {
    gates.push(gate('signProcedure exists', false, 'Missing file'))
  }

  // Check 2: VisitActionToolbar.tsx passes expected_updated_at
  const toolbarPath = join(ROOT, 'components', 'subjects', 'visits', 'VisitActionToolbar.tsx')
  if (existsSync(toolbarPath)) {
    const content = readFileSync(toolbarPath, 'utf8')
    gates.push(gate('VisitActionToolbar passes expected_updated_at', content.includes('name="expected_updated_at"'), ''))
  } else {
    gates.push(gate('VisitActionToolbar exists', false, 'Missing file'))
  }

  // Check 3: progress-note actions have OCC guard
  const progressActionsPath = join(ROOT, 'lib', 'subject', 'visits', 'progress-note', 'actions.ts')
  if (existsSync(progressActionsPath)) {
    const content = readFileSync(progressActionsPath, 'utf8')
    const hasOCC = content.includes('expectedUpdatedAt') && content.includes('note?.updated_at !== expectedUpdatedAt')
    gates.push(gate('progress-note actions have OCC guard', hasOCC, ''))
  } else {
    gates.push(gate('progress-note actions exists', false, 'Missing file'))
  }

  // Check 4: InvestigatorSignatureCard.tsx passes expectedUpdatedAt
  const invCardPath = join(ROOT, 'components', 'subjects', 'visits', 'InvestigatorSignatureCard.tsx')
  if (existsSync(invCardPath)) {
    const content = readFileSync(invCardPath, 'utf8')
    gates.push(gate('InvestigatorSignatureCard passes expectedUpdatedAt', content.includes('expectedUpdatedAt: model.updatedAt'), ''))
  } else {
    gates.push(gate('InvestigatorSignatureCard exists', false, 'Missing file'))
  }

  console.log(JSON.stringify({ phase: 'H3-Phase2-Signatures-OCC', gates }, null, 2))
  
  const failed = gates.filter((g) => !g.pass)
  if (failed.length > 0) {
    console.error('FAIL', failed)
    process.exit(1)
  }
  console.log('PASS')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
