/**
 * Phase 16B — Subject operations workspace surface.
 */

import { notFound } from 'next/navigation'
import { mapOperationalWorkQueue } from '@/lib/coordinator-operations/map-operational-work-queue'
import type { SubjectOperationsSurface } from '@/lib/coordinator-operations/types'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import {
  subjectAdverseEventsTabPath,
  subjectChartPath,
  subjectConMedsTabPath,
  subjectVisitsPath,
  visitDetailPath,
} from '@/lib/ops/paths'
import { loadSubjectRuntimeProjection } from '@/lib/projections/load'
import { MAX_SUBJECT_OPEN_SOURCE_SHOWN } from '@/lib/coordinator-operations/constants'
import { createServerClient } from '@/lib/supabase/server'
import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function loadSubjectOperationsSurface(
  studySubjectId: string,
): Promise<SubjectOperationsSurface> {
  const supabase = await createServerClient()
  const user = await getSessionUser()
  if (!user) notFound()

  const { data: subject, error: subjectError } = await supabase
    .from('study_subjects')
    .select('id, study_id, organization_id, subject_identifier, enrollment_status')
    .eq('id', studySubjectId)
    .maybeSingle()

  if (subjectError || !subject) notFound()

  const organizationId = subject.organization_id as string
  const studyId = subject.study_id as string
  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) notFound()

  const today = todayIsoDate()

  const [subjectProjection, visits, sourceSets, adverseEvents, orchRow] = await Promise.all([
    loadSubjectRuntimeProjection(supabase, studySubjectId, organizationId, {
      refreshIfStale: true,
    }),
    supabase
      .from('visits')
      .select(
        `
        id,
        visit_status,
        scheduled_date,
        checked_in_at,
        visit_definitions(label, code)
      `,
      )
      .eq('study_subject_id', studySubjectId)
      .eq('organization_id', organizationId)
      .order('scheduled_date', { ascending: true }),
    supabase
      .from('source_response_sets')
      .select('id, status, visit_id, procedure_execution_id, opened_at')
      .eq('study_subject_id', studySubjectId)
      .eq('organization_id', organizationId)
      .in('status', ['draft', 'in_progress', 'opened', 'pending_review'])
      .order('opened_at', { ascending: false })
      .limit(MAX_SUBJECT_OPEN_SOURCE_SHOWN),
    supabase
      .from('subject_adverse_events')
      .select('ae_id, lifecycle_status, seriousness, severity, onset_date')
      .eq('study_subject_id', studySubjectId)
      .eq('organization_id', organizationId)
      .in('lifecycle_status', ['open', 'follow_up'])
      .order('onset_date', { ascending: false })
      .limit(6),
    supabase
      .from('subject_coordinator_orchestration_projections')
      .select('work_queue, next_actions')
      .eq('study_subject_id', studySubjectId)
      .maybeSingle(),
  ])

  const visitRows = visits.data ?? []
  const activeStatuses = new Set(['scheduled', 'checked_in', 'in_progress'])
  const currentVisitRow =
    visitRows.find((v) => activeStatuses.has(String(v.visit_status))) ??
    visitRows.find((v) => String(v.visit_status) !== 'completed' && String(v.visit_status) !== 'locked')

  const futureVisits = visitRows.filter(
    (v) => v.scheduled_date && String(v.scheduled_date) >= today && String(v.visit_status) === 'scheduled',
  )

  const currentVisit = currentVisitRow
    ? {
        id: currentVisitRow.id as string,
        label: one(currentVisitRow.visit_definitions)?.label ?? 'Current visit',
        status: String(currentVisitRow.visit_status ?? 'unknown'),
        href: visitDetailPath(currentVisitRow.id as string),
      }
    : null

  const nextScheduled = futureVisits[0]
  const nextScheduledVisit = nextScheduled
    ? {
        id: nextScheduled.id as string,
        label: one(nextScheduled.visit_definitions)?.label ?? 'Scheduled visit',
        scheduledDate: String(nextScheduled.scheduled_date),
        href: visitDetailPath(nextScheduled.id as string),
      }
    : null

  const openSourceItems = (sourceSets.data ?? []).map((set) => ({
    id: set.id as string,
    title: `Source capture · ${String(set.status ?? 'draft')}`,
    detail: set.visit_id ? 'Linked to visit' : 'Procedure source',
    href: set.procedure_execution_id
      ? `/source/capture/${set.procedure_execution_id as string}?organization_id=${organizationId}`
      : visitDetailPath(set.visit_id as string),
  }))

  const safetyIndicators = (adverseEvents.data ?? []).map((ae) => ({
    id: ae.ae_id as string,
    label: `Adverse event · ${ae.seriousness ? 'serious' : String(ae.severity ?? 'review')}`,
    detail: `Status: ${String(ae.lifecycle_status ?? 'open')}`,
    href: subjectAdverseEventsTabPath(studyId, studySubjectId, {
      returnTo: subjectChartPath(studyId, studySubjectId),
    }),
  }))

  if ((subjectProjection?.unresolvedSafetyCount ?? 0) > 0 && safetyIndicators.length === 0) {
    safetyIndicators.push({
      id: 'safety-projection',
      label: 'Unresolved safety signals',
      detail: `${subjectProjection!.unresolvedSafetyCount} item(s) from runtime projection`,
      href: subjectAdverseEventsTabPath(studyId, studySubjectId),
    })
  }

  const clinicalLinks = [
    { label: 'Subject chart', href: subjectChartPath(studyId, studySubjectId) },
    { label: 'Medical history', href: `${subjectChartPath(studyId, studySubjectId)}?tab=clinical-profile` },
    { label: 'Visit schedule', href: subjectVisitsPath(studyId, studySubjectId) },
    { label: 'Concomitant meds', href: subjectConMedsTabPath(studyId, studySubjectId) },
    {
      label: 'Adverse events',
      href: subjectAdverseEventsTabPath(studyId, studySubjectId),
    },
  ]

  const workQueueBuckets = mapOperationalWorkQueue({
    workQueue: orchRow.data?.work_queue as Record<string, unknown> | undefined,
    missingSourceCount: subjectProjection?.incompleteSourceCount,
    safetyBlockerCount: subjectProjection?.unresolvedSafetyCount,
  })

  return {
    currentVisit,
    nextScheduledVisit,
    openSourceItems,
    safetyIndicators,
    clinicalLinks,
    workQueueBuckets,
    projectionDataAvailable: Boolean(subjectProjection) || Boolean(orchRow.data),
  }
}
