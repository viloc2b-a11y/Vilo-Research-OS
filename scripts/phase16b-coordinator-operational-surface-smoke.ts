/**
 * Phase 16B — Coordinator operational surface smoke (static + module checks).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  OPERATIONAL_WORK_QUEUE_BUCKET,
  mapOperationalWorkQueue,
} from '../lib/coordinator-operations'

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function smokeBucketMapping() {
  const buckets = mapOperationalWorkQueue({
    workQueue: {
      actionNow: [{ label: 'Sign visit', kind: 'signature', priority: 90 }],
      blocked: [{ label: 'Visit locked', kind: 'blocked', priority: 50 }],
      piReview: [{ label: 'PI review required', kind: 'pi_review', priority: 70 }],
      escalation: [{ label: 'Safety escalation', kind: 'escalation', priority: 80 }],
      coordinatorFollowUp: [{ label: 'Follow up query', kind: 'follow_up', priority: 40 }],
    },
    missingSourceCount: 2,
    safetyBlockerCount: 1,
  })

  const names = buckets.map((b) => b.bucket)
  assert.ok(names.includes(OPERATIONAL_WORK_QUEUE_BUCKET.DO_NOW))
  assert.ok(names.includes(OPERATIONAL_WORK_QUEUE_BUCKET.BLOCKED))
  assert.ok(names.includes(OPERATIONAL_WORK_QUEUE_BUCKET.NEEDS_PI))
  assert.ok(names.includes(OPERATIONAL_WORK_QUEUE_BUCKET.SOURCE_INCOMPLETE))
  assert.ok(names.includes(OPERATIONAL_WORK_QUEUE_BUCKET.SAFETY_GOVERNANCE))
  assert.ok(names.includes(OPERATIONAL_WORK_QUEUE_BUCKET.FOLLOW_UP_LATER))
}

function smokeRoutesExist() {
  const routes = [
    'app/(ops)/command-center/page.tsx',
    'app/(ops)/studies/[studyId]/workspace/page.tsx',
    'app/(ops)/subjects/[subjectId]/workspace/page.tsx',
    'app/(ops)/visits/[visitId]/page.tsx',
  ]
  for (const route of routes) {
    assert.ok(read(route).length > 0, `missing route ${route}`)
  }
}

function smokeCoordinatorUsabilityArtifacts() {
  const commandCenter = read('app/(ops)/command-center/page.tsx')
  assert.ok(commandCenter.includes('Open operational calendar'), 'command center must link calendar')
  assert.ok(commandCenter.includes('CoordinatorPageScroll'), 'command center must scroll')

  const subjectWorkspace = read('app/(ops)/subjects/[subjectId]/workspace/page.tsx')
  assert.ok(subjectWorkspace.includes('SubjectWorkspaceActions'), 'subject workspace needs actions')
  assert.ok(subjectWorkspace.includes('CoordinatorPageScroll'), 'subject workspace must scroll')

  assert.ok(
    read('components/runtime-ui/CoordinatorSafeErrorPanel.tsx').includes(
      "We couldn't load this section",
    ),
    'coordinator safe error panel required',
  )
  assert.ok(
    read('lib/subject/clinical-profile/load-safe.ts').includes('loadSubjectClinicalProfileSafe'),
    'safe clinical profile loader required',
  )
  assert.ok(read('app/(ops)/error.tsx').includes('CoordinatorSafeErrorPanel'), 'ops error boundary required')
}

function smokeNoSponsorLabels() {
  const files = [
    'components/coordinator-operations/StudyOperationsPanel.tsx',
    'components/coordinator-operations/OperationalWorkQueuePanel.tsx',
    'app/(ops)/command-center/page.tsx',
  ]
  for (const file of files) {
    const content = read(file).toLowerCase()
    assert.ok(!content.includes('sponsor dashboard'), `${file} must not use sponsor dashboard language`)
    assert.ok(!content.includes('fake metric'), `${file} must not claim fake metrics`)
  }
}

function smokeProjectionDerivation() {
  const mapVisit = read('lib/runtime-ui/map-visit-runtime-ui.ts')
  assert.ok(mapVisit.includes('mapVisitRuntimeWorkQueueBuckets'))

  const site = read('lib/coordinator-operations/load-site-operations.ts')
  assert.ok(site.includes('visit_coordinator_orchestration_projections'))
  assert.ok(site.includes('visit_readiness_projections'))

  const study = read('lib/coordinator-operations/load-study-operations.ts')
  assert.ok(study.includes('loadStudyExecutionProjection'))

  const subject = read('lib/coordinator-operations/load-subject-operations.ts')
  assert.ok(subject.includes('subject_coordinator_orchestration_projections'))
  assert.ok(subject.includes('loadSubjectRuntimeProjection'))
}

function smokePilotGuardrails() {
  const guardrails = read('lib/runtime-ui/guardrails.ts')
  assert.ok(guardrails.includes('MAX_WORK_QUEUE_ITEMS_SHOWN'))

  const panel = read('components/coordinator-operations/OperationalWorkQueuePanel.tsx')
  assert.ok(panel.includes('from runtime projections'))
  assert.ok(!panel.includes('technicalMessage'))
}

function smokePagesWired() {
  assert.ok(read('app/(ops)/command-center/page.tsx').includes('loadSiteOperationsSurface'))
  assert.ok(read('app/(ops)/studies/[studyId]/workspace/page.tsx').includes('StudyOperationsPanel'))
  assert.ok(read('app/(ops)/subjects/[subjectId]/workspace/page.tsx').includes('SubjectOperationsPanel'))
  assert.ok(read('app/(ops)/visits/[visitId]/page.tsx').includes('VisitRuntimeActionPanel'))
}

function main() {
  smokeBucketMapping()
  smokeRoutesExist()
  smokeCoordinatorUsabilityArtifacts()
  smokeNoSponsorLabels()
  smokeProjectionDerivation()
  smokePilotGuardrails()
  smokePagesWired()
  console.log('phase16b-coordinator-operational-surface-smoke: PASS')
}

main()
