import { createClient } from '@supabase/supabase-js'
import { RUNTIME_CHAIN_CHECKLIST } from '@/lib/runtime-validation/checklist'
import {
  deriveOverallStatus,
  failure,
  formatFailureReportMarkdown,
} from '@/lib/runtime-validation/failure-report'
import { runLivePilotValidation } from '@/lib/runtime-validation/validate-live-pilot'
import { runStaticIntegrityValidation, defaultProjectRoot } from '@/lib/runtime-validation/validate-static'
import { runSyntheticChainValidation } from '@/lib/runtime-validation/validate-synthetic-chain'
import type { RuntimeE2EReport } from '@/lib/runtime-validation/types'

export type RunRuntimeE2EOptions = {
  projectRoot?: string
  live?: boolean
  pilot?: {
    studyId?: string
    studySubjectId?: string
    visitId?: string
    organizationId?: string
  }
  supabaseUrl?: string
  supabaseServiceKey?: string
  applyAutomation?: boolean
  actorUserId?: string | null
}

const RECOMMENDED_FIXES_BASE = [
  'Run npm run integrity:audit:strict and clear blocker paths before production pilot.',
  'Apply migrations 0076–0081 on staging; verify visit_readiness + orchestration + automation tables.',
  'Use PHASE11_* env vars with a PARA pilot subject that has blocked visit state for full live validation.',
  'Coordinator must explicitly apply automation — never expect blind apply on projection refresh.',
]

const STATUS_RANK: Record<RuntimeE2EReport['chainChecks'][number]['status'], number> = {
  pass: 0,
  skip: 1,
  warn: 2,
  fail: 3,
}

function selectDisplayCheck(
  report: RuntimeE2EReport,
  goal: number,
  id: string,
): RuntimeE2EReport['chainChecks'][number] | undefined {
  const matches = report.chainChecks.filter((c) => c.goal === goal || c.id === id)
  if (matches.length === 0) return undefined

  const liveMatches = matches.filter((c) => c.id.endsWith('-live'))
  const pool = report.mode === 'hybrid' && liveMatches.length > 0 ? liveMatches : matches

  return [...pool].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])[0]
}

export async function runRuntimeE2EValidation(
  options: RunRuntimeE2EOptions = {},
): Promise<RuntimeE2EReport> {
  const projectRoot = options.projectRoot ?? defaultProjectRoot()
  const staticResult = runStaticIntegrityValidation(projectRoot)
  const syntheticChecks = await runSyntheticChainValidation()

  const chainChecks = [...syntheticChecks, ...staticResult.checks]
  const failures = [...staticResult.failures]
  let mode: RuntimeE2EReport['mode'] = 'offline'
  let integrityReport: Record<string, unknown> | null = null
  let replaySummary: Record<string, unknown> | null = null
  let projectionSummary: Record<string, unknown> | null = null
  let uiModelSummary: Record<string, unknown> | null = null

  const pilot = {
    studyId: options.pilot?.studyId ?? null,
    studySubjectId: options.pilot?.studySubjectId ?? null,
    visitId: options.pilot?.visitId ?? null,
    organizationId: options.pilot?.organizationId ?? null,
  }

  if (options.live && options.supabaseUrl && options.supabaseServiceKey && pilot.visitId && pilot.organizationId && pilot.studyId && pilot.studySubjectId) {
    mode = 'hybrid'
    const supabase = createClient(options.supabaseUrl, options.supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const live = await runLivePilotValidation({
      supabase,
      scope: {
        organizationId: pilot.organizationId,
        studyId: pilot.studyId,
        studySubjectId: pilot.studySubjectId,
        visitId: pilot.visitId,
      },
      applyAutomation: options.applyAutomation,
      actorUserId: options.actorUserId,
    })
    chainChecks.push(...live.checks)
    failures.push(...live.failures)
    integrityReport = live.integrityReport
    replaySummary = live.replaySummary
    projectionSummary = live.projectionSummary
    uiModelSummary = live.uiModelSummary
  } else if (options.live) {
    chainChecks.push({
      id: 'live-pilot',
      goal: 1,
      label: 'Live pilot scope resolved',
      status: 'fail',
      detail:
        'Live mode requested but pilot scope or Supabase service-role configuration was not resolved.',
    })
    failures.push(
      failure(
        'live-pilot',
        'blocker',
        'Live mode skipped — set PHASE11_VISIT_ID, PHASE11_STUDY_ID, PHASE11_SUBJECT_ID, PHASE11_ORG_ID, and Supabase service role env.',
      ),
    )
  }

  const remainingBlockers: string[] = []
  if (staticResult.summary.directMutationBlockers > 0) {
    remainingBlockers.push(`${staticResult.summary.directMutationBlockers} static direct-mutation blocker(s) in lib/`)
  }
  for (const c of chainChecks.filter((x) => x.status === 'fail')) {
    remainingBlockers.push(`[${c.id}] ${c.label}`)
  }

  const recommendedFixes = [...RECOMMENDED_FIXES_BASE]
  if (staticResult.summary.directMutationBlockers > 0) {
    recommendedFixes.unshift('Resolve static integrity blockers before coordinator pilot sign-off.')
  }

  const report: RuntimeE2EReport = {
    phase: 'phase11-runtime-e2e',
    runAt: new Date().toISOString(),
    mode,
    pilot,
    overallStatus: deriveOverallStatus(chainChecks),
    chainChecks,
    failures,
    integrityAudit: {
      directMutationBlockers: staticResult.summary.directMutationBlockers,
      directMutationWarnings: staticResult.summary.directMutationWarnings,
      catalogSilent: staticResult.summary.catalogSilent,
    },
    integrityReport,
    replaySummary,
    projectionSummary,
    uiModelSummary,
    remainingBlockers,
    recommendedFixes,
  }

  return report
}

export function printRuntimeE2EReport(report: RuntimeE2EReport): void {
  console.log('=== Phase 11 Runtime E2E Validation ===\n')
  console.log(`Mode: ${report.mode} | Overall: ${report.overallStatus.toUpperCase()}`)
  console.log(`Pilot: study=${report.pilot.studyId ?? 'n/a'} visit=${report.pilot.visitId ?? 'n/a'}\n`)

  console.log('--- Runtime chain checklist ---')
  for (const item of RUNTIME_CHAIN_CHECKLIST) {
    const check = selectDisplayCheck(report, item.goal, item.id)
    const icon = check?.status === 'pass' ? 'PASS' : check?.status === 'skip' ? 'SKIP' : check?.status === 'warn' ? 'WARN' : check?.status === 'fail' ? 'FAIL' : '—'
    console.log(`  [${icon}] ${item.label}`)
    if (check?.detail) console.log(`         ${check.detail}`)
    if (report.mode === 'hybrid' && check?.id.endsWith('-live')) {
      console.log(`         source=${check.id}`)
    }
  }

  if (report.integrityAudit) {
    console.log('\n--- Integrity audit (static) ---')
    console.log(`  Blockers: ${report.integrityAudit.directMutationBlockers}`)
    console.log(`  Warnings: ${report.integrityAudit.directMutationWarnings}`)
  }

  if (report.replaySummary) {
    console.log('\n--- Replay (live) ---')
    console.log(JSON.stringify(report.replaySummary, null, 2))
  }

  if (report.projectionSummary) {
    console.log('\n--- Projections (live) ---')
    console.log(JSON.stringify(report.projectionSummary, null, 2))
  }

  if (report.uiModelSummary) {
    console.log('\n--- UI model (live) ---')
    console.log(JSON.stringify(report.uiModelSummary, null, 2))
  }

  if (report.remainingBlockers.length > 0) {
    console.log('\n--- Remaining blockers ---')
    for (const b of report.remainingBlockers) console.log(`  - ${b}`)
  }

  if (report.recommendedFixes.length > 0) {
    console.log('\n--- Recommended fixes before real pilot ---')
    for (const r of report.recommendedFixes) console.log(`  - ${r}`)
  }

  console.log('\n' + formatFailureReportMarkdown(report).split('\n').slice(0, 5).join('\n') + ' …')
}
