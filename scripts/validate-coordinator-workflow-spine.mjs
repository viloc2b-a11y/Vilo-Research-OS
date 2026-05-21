/**
 * Static QA — coordinator operating spine (Phases A–C).
 * Run: node scripts/validate-coordinator-workflow-spine.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(rel) {
  const path = join(root, rel)
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf8')
}

const checks = []

function pass(id, detail) {
  checks.push({ id, status: 'PASS', detail })
}

function fail(id, detail) {
  checks.push({ id, status: 'FAIL', detail })
}

const page = read('app/(ops)/page.tsx')
if (page?.includes("redirect('/command-center')")) {
  pass(1, 'Root / redirects to /command-center')
} else {
  fail(1, 'app/(ops)/page.tsx missing redirect to /command-center')
}

const login = read('components/login/login-form.tsx')
const authCb = read('app/auth/callback/route.ts')
if (
  login?.includes("'/command-center'")
  && login?.includes("rawRedirect === '/' ? '/command-center'")
  && authCb?.includes("?? '/command-center'")
) {
  pass(1, 'Login and auth callback default to /command-center')
} else {
  fail(1, 'Login/auth callback not defaulting to /command-center')
}

const alerts = read('lib/visits/loadCoordinatorVisitAlerts.ts')
if (alerts?.includes('visitDetailPath(visitId)')) {
  pass(2, 'Visit alerts href uses visitDetailPath(visitId)')
} else {
  fail(2, 'loadCoordinatorVisitAlerts still points to visits list or wrong path')
}

const visitPage = read('app/(ops)/visits/[visitId]/page.tsx')
const progressSteps = read('lib/visits/visit-progress-steps.ts')
if (
  visitPage?.includes('buildVisitProgressSteps')
  && progressSteps?.includes("'check-in'")
  && !progressSteps?.includes('Labs')
) {
  pass(3, 'Progress strip uses buildVisitProgressSteps without Labs step')
} else {
  fail(3, 'Visit progress strip missing data-backed steps or still has Labs')
}

if (
  visitPage?.includes('subjectAdverseEventsTabPath')
  && visitPage?.includes('returnToOpts')
  && visitPage?.includes('VisitClinicalLinkPanel')
) {
  pass(4, 'AE tab deep-links to subject AE with returnTo')
} else {
  fail(4, 'AE tab stub or missing returnTo deep link')
}

if (
  visitPage?.includes('subjectConMedsTabPath')
  && visitPage?.includes('Open Subject ConMeds')
) {
  pass(5, 'ConMeds tab deep-links to subject ConMeds')
} else {
  fail(5, 'ConMeds tab stub or missing deep link')
}

if (
  visitPage?.includes('Labs are tracked through protocol procedures')
  && !visitPage?.includes('Coming soon')
  && visitPage?.includes('Visit notes are captured through source')
) {
  pass(6, 'Labs/Notes show honest guidance, no coming soon')
} else {
  fail(6, 'Labs/Notes still show coming soon or missing guidance')
}

const captureForm = read('components/source/capture-form.tsx')
const captureActions = read('components/source/capture-completion-actions.tsx')
if (
  captureForm?.includes('CaptureCompletionActions')
  && captureActions?.includes('Return to Visit Workspace')
  && captureActions?.includes('Continue:')
  && captureActions?.includes('Open Visit Workflow / Closeout')
) {
  pass(7, 'Capture save/submit completion CTAs present')
  pass(8, 'Submit fallback to Workflow/Closeout when no next procedure')
} else {
  fail(7, 'Capture completion CTAs missing')
  fail(8, 'Capture submit secondary CTA incomplete')
}

if (visitPage?.includes('VisitCloseoutHeaderIndicators') && visitPage?.includes('deriveVisitCloseoutHeaderChips')) {
  pass(9, 'Header closeout chips derived from existing closeout bundle')
} else {
  fail(9, 'Header signature indicators missing')
}

const todayVisits = read('lib/visits/loadTodayVisits.ts')
if (todayVisits?.includes('subjectChartPath(studyId, subjectId)')) {
  pass(10, 'Today visits hrefSubject uses study-scoped subjectChartPath')
} else {
  fail(10, 'loadTodayVisits still uses legacy /subjects/{id}')
}

const subjectPage = read('app/(ops)/subjects/[subjectId]/page.tsx')
if (subjectPage?.includes('SubjectReturnToVisitBanner') && subjectPage?.includes("startsWith('/visits/')")) {
  pass(4, 'Subject page shows return banner for /visits/ returnTo')
  pass(5, 'returnTo banner supports ConMeds/AE round-trip')
} else {
  fail(4, 'Subject returnTo banner missing')
}

const broken = []
if (visitPage?.match(/subjectPath\s*=\s*`\/subjects\//)) {
  broken.push('visit page subjectPath uses legacy /subjects/{id}')
}
if (todayVisits?.includes('`/subjects/${subjectId}`')) {
  broken.push('loadTodayVisits hrefSubject legacy pattern')
}
if (alerts?.includes('/subjects/${subjectId}/visits')) {
  broken.push('loadCoordinatorVisitAlerts visits list href')
}

const failed = checks.filter((c) => c.status === 'FAIL')
console.log('Coordinator Workflow Spine — static QA\n')
for (const c of checks) {
  console.log(`${c.status.padEnd(4)} #${c.id} ${c.detail}`)
}
if (broken.length) {
  console.log('\nBroken link patterns:')
  for (const b of broken) console.log(`  - ${b}`)
} else {
  console.log('\nNo broken legacy link patterns in spine loaders.')
}
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
process.exit(failed.length > 0 || broken.length > 0 ? 1 : 0)
