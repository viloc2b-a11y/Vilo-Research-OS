import { subjectChartTabPath } from '@/lib/ops/paths'
import type { SubjectOperationalIntelligence } from '@/lib/subject/operations/types'
import { loadSubjectOperationalIntelligence } from '@/lib/subject/operations/loadSubjectOperationalIntelligence'
import type {
  CloseoutCheckItem,
  CloseoutCheckSeverity,
  SubjectCloseoutReadiness,
} from '@/lib/subject/closeout/types'
import { createServerClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

const TERMINAL_VISIT_STATUSES = new Set(['completed', 'locked', 'missed', 'cancelled'])

function pushItem(
  items: CloseoutCheckItem[],
  item: Omit<CloseoutCheckItem, 'severity'> & { severity?: CloseoutCheckSeverity },
) {
  items.push({ ...item, severity: item.severity ?? 'blocker' })
}

function summarizeBlockers(items: CloseoutCheckItem[]): string | null {
  const blockers = items.filter((i) => i.severity === 'blocker')
  if (blockers.length === 0) return null
  const preview = blockers
    .slice(0, 3)
    .map((b) => b.label)
    .join('; ')
  const extra = blockers.length > 3 ? ` (+${blockers.length - 3} more)` : ''
  return `${preview}${extra}`
}

async function loadIncompleteSourceCount(
  supabase: SupabaseClient,
  subjectId: string,
  organizationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('source_response_sets')
    .select('id', { count: 'exact', head: true })
    .eq('study_subject_id', subjectId)
    .eq('organization_id', organizationId)
    .in('status', ['draft', 'in_progress'])

  if (error) return 0
  return count ?? 0
}

async function loadOpenAeCount(
  supabase: SupabaseClient,
  subjectId: string,
  organizationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('subject_adverse_events')
    .select('ae_id', { count: 'exact', head: true })
    .eq('study_subject_id', subjectId)
    .eq('organization_id', organizationId)
    .in('lifecycle_status', ['open', 'follow_up'])

  if (error) return 0
  return count ?? 0
}

export function buildSubjectCloseoutReadiness(input: {
  studyId: string
  subjectId: string
  intelligence: SubjectOperationalIntelligence
  incompleteSourceCount: number
  openAeCount: number
}): SubjectCloseoutReadiness {
  const items: CloseoutCheckItem[] = []
  const { intelligence, studyId, subjectId } = input
  const workflowHref = subjectChartTabPath(studyId, subjectId, 'workflow')
  const aeHref = subjectChartTabPath(studyId, subjectId, 'adverse-events')
  const visitsHref = subjectChartTabPath(studyId, subjectId, 'visits')

  const openVisits = intelligence.visitTimeline.filter(
    (v) => !TERMINAL_VISIT_STATUSES.has(v.visitStatus),
  )
  if (openVisits.length > 0) {
    pushItem(items, {
      id: 'open-visits',
      category: 'visits',
      label: 'Open visits',
      detail: `${openVisits.length} visit(s) are not in a terminal state (e.g. ${openVisits[0]?.visitName ?? 'visit'}).`,
      href: visitsHref,
    })
  } else {
    pushItem(items, {
      id: 'open-visits',
      category: 'visits',
      label: 'Visit lifecycle',
      detail: 'All visits are completed, locked, missed, or cancelled.',
      severity: 'pass',
    })
  }

  const unsignedVisits = intelligence.visitTimeline.filter(
    (v) =>
      v.visitStatus !== 'missed' &&
      v.visitStatus !== 'cancelled' &&
      v.visitReviewStatus !== 'investigator_signed',
  )
  if (unsignedVisits.length > 0) {
    pushItem(items, {
      id: 'visit-signatures',
      category: 'signatures',
      label: 'Investigator visit sign-off',
      detail: `${unsignedVisits.length} visit(s) still need investigator closeout signature.`,
      href: unsignedVisits[0]?.visitDetailHref ?? visitsHref,
    })
  } else {
    pushItem(items, {
      id: 'visit-signatures',
      category: 'signatures',
      label: 'Investigator visit sign-off',
      detail: 'Investigator closeout recorded on applicable visits.',
      severity: 'pass',
    })
  }

  const blockedProcedures = intelligence.validationIssues.filter(
    (i) => i.kind === 'blocked' || i.kind === 'incomplete',
  )
  if (blockedProcedures.length > 0) {
    pushItem(items, {
      id: 'procedure-validation',
      category: 'source',
      label: 'Procedure validation',
      detail: `${blockedProcedures.length} procedure(s) are blocked or incomplete.`,
      href: blockedProcedures[0]?.href,
    })
  } else {
    pushItem(items, {
      id: 'procedure-validation',
      category: 'source',
      label: 'Procedure validation',
      detail: 'No blocked or incomplete procedure validation on this subject.',
      severity: 'pass',
    })
  }

  if (input.incompleteSourceCount > 0) {
    pushItem(items, {
      id: 'incomplete-source',
      category: 'source',
      label: 'Incomplete source capture',
      detail: `${input.incompleteSourceCount} source response set(s) are still draft or in progress.`,
      href: blockedProcedures[0]?.href ?? visitsHref,
    })
  } else {
    pushItem(items, {
      id: 'incomplete-source',
      category: 'source',
      label: 'Incomplete source capture',
      detail: 'No draft or in-progress source sets on this subject.',
      severity: 'pass',
    })
  }

  if (intelligence.pendingActions.length > 0) {
    pushItem(items, {
      id: 'open-workflow',
      category: 'workflow',
      label: 'Open workflow tasks',
      detail: `${intelligence.pendingActions.length} workflow item(s) remain open.`,
      severity: 'warning',
      href: intelligence.pendingActions[0]?.href ?? workflowHref,
    })
  } else {
    pushItem(items, {
      id: 'open-workflow',
      category: 'workflow',
      label: 'Open workflow tasks',
      detail: 'No open workflow tasks (excluding signature requests).',
      severity: 'pass',
    })
  }

  if (intelligence.pendingSignatures.length > 0) {
    pushItem(items, {
      id: 'pending-signatures',
      category: 'signatures',
      label: 'Pending signatures',
      detail: `${intelligence.pendingSignatures.length} coordinator or investigator signature item(s) pending.`,
      severity: 'warning',
      href: intelligence.pendingSignatures[0]?.href ?? visitsHref,
    })
  } else {
    pushItem(items, {
      id: 'pending-signatures',
      category: 'signatures',
      label: 'Pending signatures',
      detail: 'No pending coordinator or investigator signature items.',
      severity: 'pass',
    })
  }

  if (input.openAeCount > 0) {
    pushItem(items, {
      id: 'open-ae',
      category: 'safety',
      label: 'Open adverse events',
      detail: `${input.openAeCount} AE(s) in open or follow-up status on the subject registry.`,
      severity: 'warning',
      href: aeHref,
    })
  } else {
    pushItem(items, {
      id: 'open-ae',
      category: 'safety',
      label: 'Open adverse events',
      detail: 'No open or follow-up AEs on the subject registry.',
      severity: 'pass',
    })
  }

  const blockerCount = items.filter((i) => i.severity === 'blocker').length
  const warningCount = items.filter((i) => i.severity === 'warning').length

  return {
    items,
    blockerCount,
    warningCount,
    canMarkCompleted: blockerCount === 0,
    canTerminateWithReason: blockerCount === 0,
    blockerSummary: summarizeBlockers(items),
  }
}

export async function loadSubjectCloseoutReadiness(input: {
  subjectId: string
  studyId: string
  organizationId: string
}): Promise<{ ok: true; data: SubjectCloseoutReadiness } | { ok: false; error: string }> {
  const intelligenceResult = await loadSubjectOperationalIntelligence(input)
  if (!intelligenceResult.ok) {
    return { ok: false, error: intelligenceResult.error }
  }

  const supabase = await createServerClient()
  const [incompleteSourceCount, openAeCount] = await Promise.all([
    loadIncompleteSourceCount(supabase, input.subjectId, input.organizationId),
    loadOpenAeCount(supabase, input.subjectId, input.organizationId),
  ])

  return {
    ok: true,
    data: buildSubjectCloseoutReadiness({
      studyId: input.studyId,
      subjectId: input.subjectId,
      intelligence: intelligenceResult.data,
      incompleteSourceCount,
      openAeCount,
    }),
  }
}

/** Server gate — same blocker rules as Mark Completed. */
export async function assertSubjectCloseoutAllowed(
  supabase: SupabaseClient,
  subjectId: string,
  organizationId: string,
  studyId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const intelligenceResult = await loadSubjectOperationalIntelligence({
    subjectId,
    studyId,
    organizationId,
  })
  if (!intelligenceResult.ok) {
    return { ok: false, message: intelligenceResult.error }
  }

  const [incompleteSourceCount, openAeCount] = await Promise.all([
    loadIncompleteSourceCount(supabase, subjectId, organizationId),
    loadOpenAeCount(supabase, subjectId, organizationId),
  ])

  const readiness = buildSubjectCloseoutReadiness({
    studyId,
    subjectId,
    intelligence: intelligenceResult.data,
    incompleteSourceCount,
    openAeCount,
  })

  if (!readiness.canMarkCompleted) {
    return {
      ok: false,
      message: readiness.blockerSummary
        ? `Subject closeout blocked: ${readiness.blockerSummary}. Resolve blockers on the checklist before continuing.`
        : 'Subject closeout blocked by unresolved operational blockers.',
    }
  }

  return { ok: true }
}
