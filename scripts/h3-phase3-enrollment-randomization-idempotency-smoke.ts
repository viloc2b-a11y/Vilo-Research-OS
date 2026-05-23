import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function gate(name: string, pass: boolean, detail: string = '') {
  return { name, pass, detail }
}

async function main() {
  const gates: ReturnType<typeof gate>[] = []

  const chartActionsPath = join(ROOT, 'lib', 'subject', 'subject-chart', 'actions.ts')
  if (existsSync(chartActionsPath)) {
    const content = readFileSync(chartActionsPath, 'utf8')
    const occGeneral = content.includes('expectedUpdatedAt') && content.includes('This subject has already been enrolled or randomized')
    gates.push(gate('Subject chart actions have OCC guard', occGeneral, ''))
  } else {
    gates.push(gate('Subject chart actions exist', false, 'Missing file'))
  }

  const visitsActionsPath = join(ROOT, 'lib', 'visits', 'actions.ts')
  if (existsSync(visitsActionsPath)) {
    const content = readFileSync(visitsActionsPath, 'utf8')
    const occVisits = content.includes('expectedUpdatedAt') && content.includes('This subject has already been enrolled or randomized')
    gates.push(gate('Visit actions have OCC guard for schedule generation', occVisits, ''))
  } else {
    gates.push(gate('Visit actions exist', false, 'Missing file'))
  }

  const generalFormPath = join(ROOT, 'components', 'subject', 'subject-general-form.tsx')
  if (existsSync(generalFormPath)) {
    const content = readFileSync(generalFormPath, 'utf8')
    const hasInput = content.includes('name="expected_updated_at"')
    gates.push(gate('SubjectGeneralForm passes expected_updated_at', hasInput, ''))
  } else {
    gates.push(gate('SubjectGeneralForm exists', false, 'Missing file'))
  }

  const subjectPagePath = join(ROOT, 'app', '(ops)', 'subjects', '[subjectId]', 'page.tsx')
  if (existsSync(subjectPagePath)) {
    const content = readFileSync(subjectPagePath, 'utf8')
    const passesUpdatedAt = content.includes('updatedAt: subject.updated_at as string')
    gates.push(gate('Subject page passes updatedAt to generalSubject', passesUpdatedAt, ''))
  } else {
    gates.push(gate('Subject page exists', false, 'Missing file'))
  }

  console.log(JSON.stringify({ phase: 'H3-Phase3-Enrollment-Idempotency', gates }, null, 2))
  
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
