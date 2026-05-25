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
    'app/(ops)/studies/new/page.tsx',
    'app/(ops)/studies/[studyId]/workspace/page.tsx',
    'app/(ops)/subjects/[subjectId]/workspace/page.tsx',
    'app/(ops)/visits/[visitId]/page.tsx',
  ]
  for (const route of routes) {
    assert.ok(read(route).length > 0, `missing route ${route}`)
  }
}

function smokeProjectionPersistUsesServiceRole() {
  const persist = read('lib/operational-intelligence/persist.ts')
  const runtimePersist = read('lib/projections/runtime-projection-persist.ts')

  assert.ok(
    runtimePersist.includes('getRuntimeProjectionServiceClient'),
    'runtime projection service client required',
  )
  assert.ok(
    runtimePersist.includes('persistDerivedProjectionSafe'),
    'fail-soft derived projection persist required',
  )
  assert.ok(
    !persist.includes('if (error) throw new Error'),
    'operational intelligence persist must not throw on RLS failure',
  )
  assert.ok(
    persist.includes('persistDerivedProjectionSafe'),
    'operational intelligence persist must use service-role helper',
  )
}

function smokeCreateStudyServerActionBoundary() {
  const actions = read('lib/studies/actions.ts')
  const state = read('lib/studies/create-study-action-state.ts')

  assert.ok(actions.includes("'use server'"), 'create study actions must be server actions')
  assert.ok(
    !actions.includes('export const INITIAL_CREATE_STUDY_STATE'),
    'initial state must not be exported from use server file',
  )
  assert.ok(
    !actions.includes('export type CreateStudyActionState'),
    'action state type must not be exported from use server file',
  )
  assert.ok(state.includes('INITIAL_CREATE_STUDY_STATE'), 'initial state belongs in state module')
  assert.match(actions, /export async function createStudy/, 'createStudy must be async export')
}

function smokeNewStudyPageScroll() {
  const page = read('app/(ops)/studies/new/page.tsx')
  const scroll = read('components/runtime-ui/CoordinatorPageScroll.tsx')

  assert.ok(page.includes('CoordinatorPageScroll'), 'new study page needs CoordinatorPageScroll')
  assert.ok(page.includes('pb-24'), 'new study page needs bottom padding for submit reachability')
  assert.ok(scroll.includes('min-h-0'), 'scroll host needs min-h-0 in flex shell')
}

function smokeStudyWorkspaceTableScroll() {
  const workspace = read('app/(ops)/studies/[studyId]/workspace/page.tsx')
  const panel = read('components/coordinator-operations/StudyVisitSourceContinuityPanel.tsx')
  const scroll = read('components/runtime-ui/OperationalTableScroll.tsx')

  assert.ok(workspace.includes('StudyVisitSourceContinuityPanel'), 'study workspace needs continuity panel')
  assert.ok(panel.includes('study-visit-source-continuity-scroll'), 'continuity scroll container required')
  assert.ok(panel.includes('min-w-[960px]'), 'continuity table min width required')
  assert.ok(scroll.includes('overflow-x-auto'), 'operational table scroll wrapper required')
  assert.ok(scroll.includes('min-w-0'), 'table scroll parent needs min-w-0')
}

function smokeCommandCenterCompression() {
  const commandCenter = read('app/(ops)/command-center/page.tsx')
  const toolbar = read('components/coordinator-operations/CommandCenterOperationsToolbar.tsx')

  assert.ok(commandCenter.includes('CommandCenterOperationsToolbar'), 'compact operations toolbar required')
  assert.ok(toolbar.includes('cc-operations-toolbar'), 'toolbar landmark id required')
  assert.ok(toolbar.includes('Open study workspace'), 'active study workspace link required')
  assert.ok(toolbar.includes('operationalCalendarPath'), 'calendar route required')
  assert.ok(toolbar.includes('Calendar</span>'), 'compact calendar control required')

  const topActionsIndex = commandCenter.indexOf('CoordinatorTopActionsPanel')
  const summaryIndex = commandCenter.indexOf('cc-summary-metrics')
  const detailIndex = commandCenter.indexOf('cc-detail-sections')
  assert.ok(topActionsIndex >= 0, 'top next actions panel required')
  assert.ok(summaryIndex >= 0, 'summary metrics section required')
  assert.ok(topActionsIndex < summaryIndex, 'next actions must precede summary metrics')
  assert.ok(topActionsIndex < detailIndex, 'next actions must precede detail sections')

  assert.ok(commandCenter.includes('compact'), 'command center uses compact coordinator panels')
  assert.ok(!commandCenter.includes('Open operational calendar'), 'large calendar promo card removed')
  assert.ok(!commandCenter.includes('Active studies</CardTitle>'), 'large active studies card removed')
}

function smokeCoordinatorUsabilityArtifacts() {
  const commandCenter = read('app/(ops)/command-center/page.tsx')
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
  smokeProjectionPersistUsesServiceRole()
  smokeCreateStudyServerActionBoundary()
  smokeNewStudyPageScroll()
  smokeStudyWorkspaceTableScroll()
  smokeCommandCenterCompression()
  smokeCoordinatorUsabilityArtifacts()
  smokeNoSponsorLabels()
  smokeProjectionDerivation()
  smokePilotGuardrails()
  smokePagesWired()
  console.log('phase16b-coordinator-operational-surface-smoke: PASS')
}

main()
