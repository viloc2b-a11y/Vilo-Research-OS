/**
 * Phase 16B — Site operations home aggregates (projection-derived).
 */

import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { applyOperationalCalmToSiteSurface } from '@/lib/coordinator-calm'
import { classifyActorForOrganization } from '@/lib/external-access/runtime-isolation'
import {
  MAX_SITE_TOP_ACTIONS,
  OPERATIONAL_WORK_QUEUE_BUCKET,
} from '@/lib/coordinator-operations/constants'
import { mapOperationalWorkQueue } from '@/lib/coordinator-operations/map-operational-work-queue'
import { mapSiteDefensePreventionQueueToCoordinatorBucket } from '@/lib/coordinator-operations/map-site-defense-prevention-queue'
import type {
  OperationalNextActionItem,
  OperationalWorkQueueBucket,
  SiteOperationsSurface,
} from '@/lib/coordinator-operations/types'
import { studyWorkspacePath, visitDetailPath } from '@/lib/ops/paths'
import { createServerClient } from '@/lib/supabase/server'
import { detectInternalRisksWithInput } from '@/lib/site-defense'
import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import { loadCoordinatorVisitAlerts } from '@/lib/visits/loadCoordinatorVisitAlerts'
import type { SupabaseClient } from '@supabase/supabase-js'

type OrchRow = {
  visit_id: string
  study_id: string
  next_actions: Array<{
    id: string
    label: string
    detail: string
    priority: number
    href?: string | null
    requiresPiReview?: boolean
    requiresEscalation?: boolean
  }>
  work_queue: Record<string, unknown>
  studies?: { name?: string } | { name?: string }[] | null
  visits?: {
    visit_status?: string
    scheduled_date?: string
    study_subjects?: { subject_identifier?: string } | { subject_identifier?: string }[] | null
    visit_definitions?: { label?: string } | { label?: string }[] | null
  } | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function visitScopeLabel(row: OrchRow): string {
  const visit = row.visits
  const subject = one(visit?.study_subjects)
  const def = one(visit?.visit_definitions)
  const study = one(row.studies)
  const parts = [
    subject?.subject_identifier,
    def?.label ?? 'Visit',
    study?.name,
  ].filter(Boolean)
  return parts.join(' · ') || `Visit ${row.visit_id.slice(0, 8)}`
}

export async function loadSiteOperationsSurface(
  supabase?: SupabaseClient,
): Promise<SiteOperationsSurface> {
  const client = supabase ?? (await createServerClient())
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const organizationIds = memberships
    .map((m) => m.organization_id)
    .filter(
      (orgId, index, all) =>
        all.indexOf(orgId) === index
        && classifyActorForOrganization(memberships, orgId).mayAccessInternalRuntime,
    )

  const empty: SiteOperationsSurface = {
    activeStudies: [],
    blockedVisitCount: 0,
    overdueVisitCount: 0,
    subjectsNeedingActionCount: 0,
    unresolvedSourceSignatureCount: 0,
    topNextActions: [],
    workQueueBuckets: [],
    projectionDataAvailable: false,
  }

  if (organizationIds.length === 0) return empty

  const today = todayIsoDate()

  const [studiesResult, orchResult, readinessResult, alerts, sourceIncomplete, pendingSignatures] =
    await Promise.all([
      client
        .from('studies')
        .select('id, name, status')
        .in('organization_id', organizationIds)
        .neq('status', 'archived')
        .order('name', { ascending: true })
        .limit(12),
      client
        .from('visit_coordinator_orchestration_projections')
        .select(
          `
          visit_id,
          study_id,
          next_actions,
          work_queue,
          top_priority_score,
          studies(name),
          visits(
            visit_status,
            scheduled_date,
            study_subjects(subject_identifier),
            visit_definitions(label)
          )
        `,
        )
        .in('organization_id', organizationIds)
        .gt('top_priority_score', 0)
        .order('top_priority_score', { ascending: false })
        .limit(40),
      client
        .from('visit_readiness_projections')
        .select('visit_id, readiness_status, missing_source_count, unsigned_procedure_count, safety_blocker_count')
        .in('organization_id', organizationIds)
        .in('readiness_status', ['blocked', 'attention']),
      loadCoordinatorVisitAlerts(organizationIds),
      client
        .from('source_response_sets')
        .select('id', { count: 'exact', head: true })
        .in('organization_id', organizationIds)
        .in('status', ['draft', 'in_progress', 'pending_review']),
      client
        .from('procedure_executions')
        .select('id', { count: 'exact', head: true })
        .in('organization_id', organizationIds)
        .eq('is_signed', false)
        .eq('is_locked', false)
        .in('execution_status', ['completed', 'verified']),
    ])

  const activeStudies = (studiesResult.data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    status: s.status as string | null,
    href: studyWorkspacePath(s.id as string),
  }))

  const blockedVisitCount =
    readinessResult.data?.filter((r) => r.readiness_status === 'blocked').length ?? 0

  const overdueVisitCount = alerts.filter((a) => {
    if (a.alertType !== 'missed' && a.alertType !== 'out_of_window') return false
    return a.scheduledDate ? a.scheduledDate < today : true
  }).length

  const orchRows = (orchResult.data ?? []) as OrchRow[]
  const projectionDataAvailable = orchRows.length > 0 || (readinessResult.data?.length ?? 0) > 0

  const topNextActions: OperationalNextActionItem[] = []
  for (const row of orchRows) {
    const actions = row.next_actions ?? []
    for (const action of actions) {
      topNextActions.push({
        id: `${row.visit_id}:${action.id}`,
        label: action.label,
        detail: action.detail ?? null,
        href: action.href ?? visitDetailPath(row.visit_id),
        priority: action.priority,
        scopeLabel: visitScopeLabel(row),
        requiresPiReview: Boolean(action.requiresPiReview),
        requiresEscalation: Boolean(action.requiresEscalation),
      })
    }
  }

  topNextActions.sort((a, b) => b.priority - a.priority)

  const aggregatedQueue: Record<string, OperationalWorkQueueBucket['items']> = {}
  const pushQueueItem = (
    bucket: string,
    item: OperationalWorkQueueBucket['items'][number],
  ) => {
    if (!aggregatedQueue[bucket]) aggregatedQueue[bucket] = []
    const key = `${item.kind}:${item.label}:${item.scopeLabel ?? ''}`
    const exists = aggregatedQueue[bucket]!.some(
      (existing) => `${existing.kind}:${existing.label}:${existing.scopeLabel ?? ''}` === key,
    )
    if (!exists) aggregatedQueue[bucket]!.push(item)
  }

  for (const row of orchRows) {
    const readiness = readinessResult.data?.find((r) => r.visit_id === row.visit_id)
    const buckets = mapOperationalWorkQueue({
      workQueue: row.work_queue as Record<string, OperationalWorkQueueBucket['items']>,
      missingSourceCount: readiness?.missing_source_count as number | undefined,
      unsignedProcedureCount: readiness?.unsigned_procedure_count as number | undefined,
      safetyBlockerCount: readiness?.safety_blocker_count as number | undefined,
    })
    for (const bucket of buckets) {
      for (const item of bucket.items) {
        pushQueueItem(bucket.bucket, {
          ...item,
          scopeLabel: visitScopeLabel(row),
          href: visitDetailPath(row.visit_id),
        })
      }
    }
  }

  for (const readiness of readinessResult.data ?? []) {
    const row = orchRows.find((orch) => orch.visit_id === readiness.visit_id)
    const runtimeId = readiness.visit_id as string
    const missingSourceCount = readiness.missing_source_count as number | undefined
    const unsignedProcedureCount = readiness.unsigned_procedure_count as number | undefined
    const safetyBlockerCount = readiness.safety_blocker_count as number | undefined
    const { riskInput } = detectInternalRisksWithInput({
      runtimeId,
      unsignedProcedureCount,
      incompleteSourceCount: missingSourceCount,
      unresolvedBlockerCount: readiness.readiness_status === 'blocked' ? 1 : 0,
      unresolvedGovernanceBlockerCount: safetyBlockerCount,
    })
    const preventionBucket = mapSiteDefensePreventionQueueToCoordinatorBucket(riskInput)
    const scopeLabel = row ? visitScopeLabel(row) : `Visit ${runtimeId.slice(0, 8)}`
    for (const item of preventionBucket.items) {
      pushQueueItem(preventionBucket.bucket, {
        ...item,
        scopeLabel,
        href: visitDetailPath(runtimeId),
      })
    }
  }

  const workQueueBuckets = Object.entries(aggregatedQueue)
    .map(([bucket, items]) => ({
      bucket,
      items: items
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 5),
    }))
    .filter((b) => b.items.length > 0)
    .sort((a, b) => {
      const order = Object.values(OPERATIONAL_WORK_QUEUE_BUCKET)
      return order.indexOf(a.bucket as (typeof order)[number]) - order.indexOf(b.bucket as (typeof order)[number])
    })

  const subjectsNeedingActionCount = new Set(
    orchRows.filter((r) => (r.next_actions?.length ?? 0) > 0).map((r) => r.visit_id),
  ).size

  return applyOperationalCalmToSiteSurface({
    activeStudies,
    blockedVisitCount,
    overdueVisitCount,
    subjectsNeedingActionCount,
    unresolvedSourceSignatureCount:
      (sourceIncomplete.count ?? 0) + (pendingSignatures.count ?? 0),
    topNextActions: topNextActions.slice(0, MAX_SITE_TOP_ACTIONS),
    workQueueBuckets,
    projectionDataAvailable,
  })
}
