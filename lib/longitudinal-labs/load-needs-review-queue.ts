import type { SupabaseClient } from '@supabase/supabase-js'
import { computeSignals } from './compute-signals'
import { mapLongitudinalLabResultRow } from './longitudinal-lab-types'
import {
  SIGNAL_KIND,
  type LabSignal,
  type LongitudinalLabResultRow,
} from './longitudinal-lab-types'
import { subjectChartTabPath, subjectChartPath } from '@/lib/ops/paths'

export type NeedsReviewSourceType = 'signal' | 'review' | 'signature'

export type NeedsReviewPriority = 'high' | 'medium' | 'low'

export type NeedsReviewQueueItem = {
  queueItemId: string
  organizationId: string
  studyId: string
  subjectId: string
  subjectIdentifier: string | null
  visitId: string | null
  sourceType: NeedsReviewSourceType
  priority: NeedsReviewPriority
  status: string
  title: string
  description: string
  createdAt: string
  reviewUrl: string
  subjectUrl: string
}

export type NeedsReviewFilters = {
  priority?: string
  type?: string
  status?: string
  subjectId?: string
}

export type NeedsReviewQueueResponse = {
  items: NeedsReviewQueueItem[]
  counts: {
    high: number
    medium: number
    low: number
  }
  filterOptions: {
    priorities: string[]
    types: string[]
    statuses: string[]
    subjects: { id: string; label: string }[]
  }
}

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending Review',
  under_review: 'Under Review',
}

const SIGNAL_LABELS: Record<string, string> = {
  out_of_range: 'Out of Range',
  clinically_significant: 'Clinically Significant',
  trend_up: 'Trend Up',
  trend_down: 'Trend Down',
  rapid_change: 'Rapid Change',
}

function getPriorityForSignalKind(kind: string): NeedsReviewPriority {
  switch (kind) {
    case SIGNAL_KIND.CLINICALLY_SIGNIFICANT:
      return 'high'
    case SIGNAL_KIND.OUT_OF_RANGE:
      return 'medium'
    case SIGNAL_KIND.TREND_UP:
    case SIGNAL_KIND.TREND_DOWN:
    case SIGNAL_KIND.RAPID_CHANGE:
      return 'low'
    default:
      return 'low'
  }
}

function getPriorityForReview(review: {
  reviewStatus: string
  piClassification: string | null
}): NeedsReviewPriority {
  if (review.piClassification === 'follow_up_required') return 'high'
  return 'medium'
}

function getPriorityForSignature(): NeedsReviewPriority {
  return 'high'
}

function formatSignalDescription(signal: LabSignal): string {
  return signal.message
}

function formatDate(d: string): string {
  try {
    return new Date(d).toISOString()
  } catch {
    return d
  }
}

async function loadSignalItems(
  supabase: SupabaseClient,
  studyId: string,
  organizationId: string,
  completedResultIds: Set<string>,
): Promise<NeedsReviewQueueItem[]> {
  const { data, error } = await supabase
    .from('longitudinal_lab_results')
    .select(`
      *,
      study_subjects!inner(subject_identifier)
    `)
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .order('collection_date', { ascending: true, nullsFirst: false })

  if (error) throw new Error(`Failed to load lab results: ${error.message}`)

  const raw = (data ?? []) as Record<string, unknown>[]
  const results = raw.map(mapLongitudinalLabResultRow)
  const subjectMap = new Map<string, string | null>()
  for (const row of raw) {
    const subject = row.study_subjects as { subject_identifier: string } | null
    subjectMap.set(String(row.subject_id), subject?.subject_identifier ?? null)
  }

  const signals = computeSignals(results)

  const items: NeedsReviewQueueItem[] = []

  for (const signal of signals) {
    if (completedResultIds.has(signal.resultId)) continue

    const priority = getPriorityForSignalKind(signal.kind)

    items.push({
      queueItemId: `sig-${signal.resultId}-${signal.kind}`,
      organizationId: signal.studyId === studyId ? organizationId : organizationId,
      studyId: signal.studyId,
      subjectId: signal.subjectId,
      subjectIdentifier: subjectMap.get(signal.subjectId) ?? null,
      visitId: null,
      sourceType: 'signal',
      priority,
      status: signal.kind,
      title: `${signal.labTestName} — ${SIGNAL_LABELS[signal.kind] ?? signal.kind}`,
      description: formatSignalDescription(signal),
      createdAt: formatDate(results.find((r) => r.id === signal.resultId)?.collectionDate ?? results.find((r) => r.id === signal.resultId)?.createdAt ?? new Date().toISOString()),
      reviewUrl: subjectChartTabPath(studyId, signal.subjectId, 'labs'),
      subjectUrl: subjectChartPath(studyId, signal.subjectId),
    })
  }

  return items
}

async function loadReviewItems(
  supabase: SupabaseClient,
  studyId: string,
  organizationId: string,
): Promise<NeedsReviewQueueItem[]> {
  const { data, error } = await supabase
    .from('lab_report_reviews')
    .select(`
      *,
      study_subjects!inner(subject_identifier),
      compliance_runtime_documents!inner(file_display_name)
    `)
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .in('review_status', ['pending_review', 'under_review'])

  if (error) throw new Error(`Failed to load reviews: ${error.message}`)

  const items: NeedsReviewQueueItem[] = []

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const reviewId = String(row.id)
    const subjectId = String(row.subject_id)
    const subject = row.study_subjects as { subject_identifier: string } | null
    const doc = row.compliance_runtime_documents as { file_display_name: string | null } | null
    const reviewStatus = String(row.review_status)
    const piClassification = row.pi_classification ? String(row.pi_classification) : null
    const reviewNotes = row.review_notes ? String(row.review_notes) : null

    const priority = getPriorityForReview({
      reviewStatus,
      piClassification,
    })

    const docName = doc?.file_display_name ?? 'Lab Report'
    const statusLabel = REVIEW_STATUS_LABELS[reviewStatus] ?? reviewStatus

    items.push({
      queueItemId: `rev-${reviewId}`,
      organizationId,
      studyId,
      subjectId,
      subjectIdentifier: subject?.subject_identifier ?? null,
      visitId: row.visit_id ? String(row.visit_id) : null,
      sourceType: 'review',
      priority,
      status: reviewStatus,
      title: `${docName} — ${statusLabel}`,
      description: piClassification === 'follow_up_required'
        ? 'PI classified as Follow-Up Required'
        : reviewNotes ?? `Lab report is ${statusLabel.toLowerCase()}.`,
      createdAt: formatDate(String(row.created_at)),
      reviewUrl: subjectChartTabPath(studyId, subjectId, 'labs'),
      subjectUrl: subjectChartPath(studyId, subjectId),
    })
  }

  return items
}

async function loadSignatureItems(
  supabase: SupabaseClient,
  studyId: string,
  organizationId: string,
): Promise<NeedsReviewQueueItem[]> {
  const { data, error } = await supabase
    .from('lab_report_reviews')
    .select(`
      *,
      study_subjects!inner(subject_identifier),
      compliance_runtime_documents!inner(file_display_name),
      operational_signature_requests!inner(status)
    `)
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .not('signature_request_id', 'is', null)
    .eq('operational_signature_requests.status', 'pending')

  if (error) throw new Error(`Failed to load signature reviews: ${error.message}`)

  const items: NeedsReviewQueueItem[] = []

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const reviewId = String(row.id)
    const subjectId = String(row.subject_id)
    const subject = row.study_subjects as { subject_identifier: string } | null
    const doc = row.compliance_runtime_documents as { file_display_name: string | null } | null

    const docName = doc?.file_display_name ?? 'Lab Report'

    items.push({
      queueItemId: `sigreq-${reviewId}`,
      organizationId,
      studyId,
      subjectId,
      subjectIdentifier: subject?.subject_identifier ?? null,
      visitId: row.visit_id ? String(row.visit_id) : null,
      sourceType: 'signature',
      priority: getPriorityForSignature(),
      status: 'signature_pending',
      title: `${docName} — Signature Pending`,
      description: 'PI/Sub-I signature requested but not yet completed.',
      createdAt: formatDate(String(row.created_at)),
      reviewUrl: subjectChartTabPath(studyId, subjectId, 'labs'),
      subjectUrl: subjectChartPath(studyId, subjectId),
    })
  }

  return items
}

async function loadCompletedResultIds(
  supabase: SupabaseClient,
  studyId: string,
  organizationId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('lab_report_reviews')
    .select('longitudinal_result_id')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .in('review_status', ['reviewed', 'rejected'])
    .not('longitudinal_result_id', 'is', null)

  if (error) throw new Error(`Failed to load completed reviews: ${error.message}`)

  return new Set(
    ((data ?? []) as Record<string, unknown>[])
      .map((r) => r.longitudinal_result_id ? String(r.longitudinal_result_id) : null)
      .filter((id): id is string => id !== null),
  )
}

export async function loadNeedsReviewQueue(
  supabase: SupabaseClient,
  studyId: string,
  organizationId: string,
  filters?: NeedsReviewFilters,
): Promise<NeedsReviewQueueResponse> {
  const completedResultIds = await loadCompletedResultIds(supabase, studyId, organizationId)

  const [signalItems, reviewItems, signatureItems] = await Promise.all([
    loadSignalItems(supabase, studyId, organizationId, completedResultIds),
    loadReviewItems(supabase, studyId, organizationId),
    loadSignatureItems(supabase, studyId, organizationId),
  ])

  let allItems = [...signalItems, ...reviewItems, ...signatureItems]

  if (filters) {
    if (filters.priority) {
      allItems = allItems.filter((item) => item.priority === filters.priority)
    }
    if (filters.type) {
      allItems = allItems.filter((item) => item.sourceType === filters.type)
    }
    if (filters.status) {
      allItems = allItems.filter((item) => item.status === filters.status)
    }
    if (filters.subjectId) {
      allItems = allItems.filter((item) => item.subjectId === filters.subjectId)
    }
  }

  allItems.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    const aOrder = order[a.priority]
    const bOrder = order[b.priority]
    if (aOrder !== bOrder) return aOrder - bOrder
    return b.createdAt.localeCompare(a.createdAt)
  })

  const high = allItems.filter((i) => i.priority === 'high').length
  const medium = allItems.filter((i) => i.priority === 'medium').length
  const low = allItems.filter((i) => i.priority === 'low').length

  const priorities = [...new Set(allItems.map((i) => i.priority))].sort()
  const types = [...new Set(allItems.map((i) => i.sourceType))].sort()
  const statuses = [...new Set(allItems.map((i) => i.status))].sort()

  const subjectMap = new Map<string, string>()
  for (const item of allItems) {
    if (item.subjectIdentifier) {
      subjectMap.set(item.subjectId, item.subjectIdentifier)
    }
  }
  const subjects = [...subjectMap.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return {
    items: allItems,
    counts: { high, medium, low },
    filterOptions: { priorities, types, statuses, subjects },
  }
}
