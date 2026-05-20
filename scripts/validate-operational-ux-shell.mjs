import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const requiredFiles = [
  'app/(ops)/command-center/page.tsx',
  'app/(ops)/command-center/loading.tsx',
  'app/(ops)/studies/[studyId]/workspace/page.tsx',
  'app/(ops)/studies/[studyId]/workspace/loading.tsx',
  'app/(ops)/subjects/[subjectId]/workspace/page.tsx',
  'app/(ops)/subjects/[subjectId]/workspace/loading.tsx',
  'app/(ops)/visits/[visitId]/page.tsx',
  'lib/ops/command-center-read-model.ts',
  'lib/ops/workspace-read-model.ts',
  'docs/OPERATIONAL-UX-SHELL-PHASE1B-QA.md',
]

const bannedUiTerms = [
  'fake data',
  'mock data',
  'lorem ipsum',
  'sample sponsor',
]

const routeFiles = [
  'app/(ops)/command-center/page.tsx',
  'app/(ops)/studies/[studyId]/workspace/page.tsx',
  'app/(ops)/subjects/[subjectId]/workspace/page.tsx',
]

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

const failures = []

for (const file of requiredFiles) {
  if (!exists(file)) failures.push(`Missing required file: ${file}`)
}

for (const file of routeFiles.filter(exists)) {
  const text = read(file).toLowerCase()
  for (const term of bannedUiTerms) {
    if (text.includes(term)) failures.push(`Banned placeholder term "${term}" in ${file}`)
  }
  if (!text.includes('href=')) failures.push(`No action links found in ${file}`)
}

const commandModel = exists('lib/ops/command-center-read-model.ts')
  ? read('lib/ops/command-center-read-model.ts')
  : ''
if (commandModel.includes(".from('source_response_validation_findings')")) {
  if (!commandModel.includes(".in('response_set_id', scopedResponseSetIds)")) {
    failures.push('Command Center blockers must be scoped through response_set_id.')
  }
}
if (!commandModel.includes('performanceResult?.model.errors.length')) {
  failures.push('Command Center must report partial VPI availability.')
}

const workspaceModel = exists('lib/ops/workspace-read-model.ts')
  ? read('lib/ops/workspace-read-model.ts')
  : ''
if (!workspaceModel.includes(".eq('organization_id', organizationId)")) {
  failures.push('Workspace read model should scope subject runtime reads by organization.')
}
if (workspaceModel.includes("subjectChartPath(studyId, '')")) {
  failures.push('Workspace read model contains broken empty subject link.')
}

if (failures.length > 0) {
  console.error('Operational UX shell validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Operational UX shell validation passed.')
