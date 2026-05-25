/**
 * Phase 16B — Study operations workspace surface.
 */

import { notFound } from 'next/navigation'
import { mapOperationalWorkQueue } from '@/lib/coordinator-operations/map-operational-work-queue'
import type { StudyOperationsSurface } from '@/lib/coordinator-operations/types'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { loadStudyExecutionProjection } from '@/lib/projections/load'
import { visitDetailPath } from '@/lib/ops/paths'
import { createServerClient } from '@/lib/supabase/server'

export async function loadStudyOperationsSurface(studyId: string): Promise<StudyOperationsSurface> {
  const supabase = await createServerClient()
  const user = await getSessionUser()
  if (!user) notFound()

  const { data: study, error: studyError } = await supabase
    .from('studies')
    .select('id, organization_id, name, status')
    .eq('id', studyId)
    .maybeSingle()

  if (studyError || !study) notFound()

  const organizationId = study.organization_id as string
  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) notFound()

  const [execution, visits, sourceSets, orchRows] = await Promise.all([
    loadStudyExecutionProjection(supabase, studyId, organizationId, { refreshIfStale: true }),
    supabase
      .from('visits')
      .select('visit_status')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId),
    supabase
      .from('source_response_sets')
      .select('status')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId),
    supabase
      .from('visit_coordinator_orchestration_projections')
      .select('visit_id, work_queue, top_priority_score')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .order('top_priority_score', { ascending: false })
      .limit(25),
  ])

  const visitStatusCounts: Record<string, number> = {}
  for (const row of visits.data ?? []) {
    const status = String(row.visit_status ?? 'unknown')
    visitStatusCounts[status] = (visitStatusCounts[status] ?? 0) + 1
  }

  const sourcePackageSummary = { draft: 0, inProgress: 0, submitted: 0, other: 0 }
  for (const row of sourceSets.data ?? []) {
    const status = String(row.status ?? '')
    if (status === 'draft') sourcePackageSummary.draft += 1
    else if (status === 'in_progress' || status === 'opened') sourcePackageSummary.inProgress += 1
    else if (status === 'submitted' || status === 'signed') sourcePackageSummary.submitted += 1
    else sourcePackageSummary.other += 1
  }

  const readinessRows = await supabase
    .from('visit_readiness_projections')
    .select('visit_id, missing_source_count, unsigned_procedure_count, safety_blocker_count')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  const readinessByVisit = new Map(
    (readinessRows.data ?? []).map((r) => [r.visit_id as string, r]),
  )

  const aggregated: Record<string, StudyOperationsSurface['workQueueBuckets'][0]['items']> = {}
  for (const row of orchRows.data ?? []) {
    const readiness = readinessByVisit.get(row.visit_id as string)
    const buckets = mapOperationalWorkQueue({
      workQueue: row.work_queue as Record<string, unknown>,
      missingSourceCount: readiness?.missing_source_count as number | undefined,
      unsignedProcedureCount: readiness?.unsigned_procedure_count as number | undefined,
      safetyBlockerCount: readiness?.safety_blocker_count as number | undefined,
    })
    for (const bucket of buckets) {
      if (!aggregated[bucket.bucket]) aggregated[bucket.bucket] = []
      for (const item of bucket.items) {
        aggregated[bucket.bucket]!.push({
          ...item,
          href: visitDetailPath(row.visit_id as string),
          scopeLabel: null,
        })
      }
    }
  }

  const workQueueBuckets = Object.entries(aggregated)
    .map(([bucket, items]) => ({
      bucket,
      items: items.sort((a, b) => b.priority - a.priority).slice(0, 5),
    }))
    .filter((b) => b.items.length > 0)

  const activeBlockers = (execution?.blockers ?? []).slice(0, 6).map((b) => ({
    id: b.id,
    label: b.label,
    detail: b.detail,
    href: b.href ?? null,
  }))

  return {
    studyExecutionReady: execution != null,
    operationalRiskLevel: execution?.operationalRiskLevel ?? null,
    visitStatusCounts,
    sourcePackageSummary,
    regulatoryReadinessNote:
      'Regulatory readiness tracking is not configured for this study yet. Use visit and source blockers until a regulatory package is published.',
    activeBlockers,
    workQueueBuckets,
    projectionDataAvailable: Boolean(execution) || (orchRows.data?.length ?? 0) > 0,
  }
}
