import { catalogSummary } from '@/lib/runtime-integrity/detect/silent-mutation-catalog'
import { collectRegistryDrift } from '@/lib/runtime-integrity/event-registry/normalize'
import { checkSubjectProjectionFreshness, checkVisitProjectionFreshness } from '@/lib/runtime-integrity/integrity/projection-freshness'
import {
  detectCataloguedReplayGaps,
  detectVisitReplayGaps,
} from '@/lib/runtime-integrity/integrity/replay-gaps'
import { RUNTIME_INTEGRITY_VERSION, type RuntimeIntegrityReport, type RuntimeIntegrityScope } from '@/lib/runtime-integrity/report/types'
import type { DirectMutationFinding } from '@/lib/runtime-integrity/detect/direct-mutation-scanner'
import type { SupabaseClient } from '@supabase/supabase-js'

function deriveOverallStatus(input: {
  projectionIssues: { issue: string }[]
  replayGaps: { severity: string }[]
  staticBlockers: number
}): RuntimeIntegrityReport['overallStatus'] {
  if (input.staticBlockers > 0) return 'critical'
  if (input.replayGaps.some((g) => g.severity === 'critical')) return 'critical'
  if (
    input.projectionIssues.some((p) => p.issue === 'missing' || p.issue === 'version_mismatch')
    || input.replayGaps.some((g) => g.severity === 'warning')
  ) {
    return 'degraded'
  }
  if (input.projectionIssues.length > 0 || input.replayGaps.length > 0) return 'attention'
  return 'healthy'
}

export async function buildRuntimeIntegrityReport(input: {
  supabase: SupabaseClient
  scope: RuntimeIntegrityScope
  scopeId: string
  organizationId: string
  studyId: string
  staticAuditFindings?: DirectMutationFinding[]
}): Promise<RuntimeIntegrityReport> {
  const computedAt = new Date().toISOString()
  let studySubjectId: string | null = null
  let visitId: string | null = null
  const projectionFreshness = []
  const replayGaps = []
  const recommendations: string[] = []

  if (input.scope === 'visit') {
    visitId = input.scopeId
    const { data: visit } = await input.supabase
      .from('visits')
      .select('study_subject_id')
      .eq('id', visitId)
      .eq('organization_id', input.organizationId)
      .maybeSingle()
    studySubjectId = (visit?.study_subject_id as string) ?? null

    projectionFreshness.push(
      ...(await checkVisitProjectionFreshness({
        supabase: input.supabase,
        visitId,
        organizationId: input.organizationId,
      })),
    )
    replayGaps.push(
      ...(await detectVisitReplayGaps({
        supabase: input.supabase,
        organizationId: input.organizationId,
        studyId: input.studyId,
        visitId,
      })),
    )
  } else if (input.scope === 'subject') {
    studySubjectId = input.scopeId
    projectionFreshness.push(
      ...(await checkSubjectProjectionFreshness({
        supabase: input.supabase,
        studySubjectId,
      })),
    )
    replayGaps.push(...detectCataloguedReplayGaps())
  } else {
    replayGaps.push(...detectCataloguedReplayGaps())
  }

  const staticBlockers =
    input.staticAuditFindings?.filter((f) => f.severity === 'blocker').length ?? 0

  const registryDrift = collectRegistryDrift()
  const catalog = catalogSummary()

  if (projectionFreshness.some((p) => p.issue === 'stale')) {
    recommendations.push('Refresh visit/subject projections via refreshProjectionsCascadeForVisit.')
  }
  if (replayGaps.some((g) => g.kind === 'missing_spine_event')) {
    recommendations.push('Backfill or patch mutations to emit operational_events per silent-mutation catalog.')
  }
  if (staticBlockers > 0) {
    recommendations.push('Run npm run integrity:audit and route clinical writes through ClinicalMutationGateway.')
  }

  const overallStatus = deriveOverallStatus({
    projectionIssues: projectionFreshness,
    replayGaps,
    staticBlockers,
  })

  const summaryParts = [
    `Status: ${overallStatus}`,
    `${projectionFreshness.length} projection issue(s)`,
    `${replayGaps.length} replay gap(s)`,
  ]
  if (staticBlockers > 0) summaryParts.push(`${staticBlockers} static blocker(s)`)

  return {
    version: RUNTIME_INTEGRITY_VERSION,
    scope: input.scope,
    scopeId: input.scopeId,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId,
    visitId,
    computedAt,
    overallStatus,
    summary: summaryParts.join(' · '),
    projectionFreshness,
    replayGaps,
    staticAudit: input.staticAuditFindings
      ? {
          blockers: staticBlockers,
          warnings: input.staticAuditFindings.filter((f) => f.severity === 'warning').length,
          topFindings: input.staticAuditFindings
            .filter((f) => f.severity !== 'info')
            .slice(0, 10),
        }
      : undefined,
    eventRegistry: {
      driftCount:
        registryDrift.nonCanonicalRegistered.length + registryDrift.legacyAliases.length,
      cataloguedSilentMutations: (catalog.silent ?? 0) + (catalog.partial ?? 0),
    },
    recommendations,
    snapshot: {
      catalogSummary: catalog,
      registryDrift,
    },
  }
}
