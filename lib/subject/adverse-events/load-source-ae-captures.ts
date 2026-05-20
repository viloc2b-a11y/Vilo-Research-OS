import {
  sourceCapturePath,
  sourceResponseSetPath,
  visitDetailPath,
} from '@/lib/ops/paths'
import { canViewBlindingScope } from '@/lib/rbac/blinding'
import type { OrganizationMembership } from '@/lib/auth/session'
import type { SubjectAdverseEventTimelineItem } from '@/lib/subject/adverse-events/types'
import { createServerClient } from '@/lib/supabase/server'

const AE_FIELD_KEYS = new Set([
  'ae_term',
  'ae_present',
  'ae_start_date',
  'onset_date',
  'ae_severity',
  'severity',
  'ae_serious',
  'seriousness',
  'ae_outcome',
  'outcome',
  'relationship_to_ip',
  'relatedness',
  'action_taken',
  'ae_end_date',
  'caused_study_discontinuation',
])

const TRIGGER_KEYS = new Set(['ae_present', 'ae_term'])

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function responseValue(row: {
  value_text: string | null
  value_boolean: boolean | null
  value_date: string | null
  value_number: number | null
}): string | null {
  if (row.value_text != null && row.value_text.trim()) return row.value_text.trim()
  if (row.value_boolean != null) return row.value_boolean ? 'Yes' : 'No'
  if (row.value_date != null) return row.value_date
  if (row.value_number != null) return String(row.value_number)
  return null
}

function parseSeriousness(values: Map<string, string>): boolean {
  const serious =
    values.get('seriousness') ?? values.get('ae_serious') ?? values.get('ae_present')
  if (!serious) return false
  const lower = serious.toLowerCase()
  return lower === 'yes' || lower === 'true' || lower === '1'
}

function deriveCaptureLifecycle(
  setStatus: string,
  hasOpenFinding: boolean,
): SubjectAdverseEventTimelineItem['lifecycleStatus'] {
  if (setStatus === 'draft' || setStatus === 'in_progress') return 'open'
  if (hasOpenFinding) return 'follow_up'
  if (
    setStatus === 'submitted' ||
    setStatus === 'pending_review' ||
    setStatus === 'reviewed' ||
    setStatus === 'signed'
  ) {
    return 'follow_up'
  }
  if (setStatus === 'corrected' || setStatus === 'addended' || setStatus === 'locked') {
    return 'resolved'
  }
  return 'closed'
}

export async function loadSourceAeCaptures(input: {
  subjectId: string
  studyId: string
  organizationId: string
  memberships: OrganizationMembership[]
}): Promise<SubjectAdverseEventTimelineItem[]> {
  const supabase = await createServerClient()

  const { data: visits } = await supabase
    .from('visits')
    .select('id, visit_definitions(label, code)')
    .eq('study_subject_id', input.subjectId)
    .eq('organization_id', input.organizationId)

  const visitIds = (visits ?? []).map((v) => v.id as string)
  if (visitIds.length === 0) return []

  const visitLabelById = new Map<string, string>()
  for (const v of visits ?? []) {
    const def = one(v.visit_definitions) as { label?: string; code?: string } | null
    visitLabelById.set(v.id as string, def?.label ?? def?.code ?? 'Visit')
  }

  const { data: sets } = await supabase
    .from('source_response_sets')
    .select('id, status, updated_at, visit_id, procedure_execution_id')
    .eq('organization_id', input.organizationId)
    .in('visit_id', visitIds)
    .order('updated_at', { ascending: false })
    .limit(40)

  const setRows = sets ?? []
  const setIds = setRows.map((s) => s.id as string)
  if (setIds.length === 0) return []

  const { data: responses } = await supabase
    .from('source_responses')
    .select(
      `
      response_set_id,
      value_text,
      value_boolean,
      value_date,
      value_number,
      updated_at,
      source_fields(field_key, blinding_scope, label)
    `,
    )
    .eq('organization_id', input.organizationId)
    .in('response_set_id', setIds)
    .eq('is_current', true)

  const valuesBySet = new Map<string, Map<string, string>>()
  const blindingBySet = new Map<string, boolean>()

  for (const row of responses ?? []) {
    const field = one(row.source_fields) as {
      field_key?: string
      blinding_scope?: string | null
      label?: string
    } | null
    const fieldKey = field?.field_key
    if (!fieldKey || !AE_FIELD_KEYS.has(fieldKey)) continue

    const scope = field?.blinding_scope ?? 'public_to_site'
    if (!canViewBlindingScope(input.memberships, scope)) {
      blindingBySet.set(row.response_set_id as string, true)
      continue
    }

    const value = responseValue(row as {
      value_text: string | null
      value_boolean: boolean | null
      value_date: string | null
      value_number: number | null
    })
    if (!value) continue

    const setId = row.response_set_id as string
    if (!valuesBySet.has(setId)) valuesBySet.set(setId, new Map())
    valuesBySet.get(setId)!.set(fieldKey, value)
  }

  const items: SubjectAdverseEventTimelineItem[] = []

  for (const set of setRows) {
    const setId = set.id as string
    if (blindingBySet.get(setId)) continue

    const values = valuesBySet.get(setId)
    if (!values || values.size === 0) continue

    const hasAeSignal = [...TRIGGER_KEYS].some((key) => {
      const v = values.get(key)
      if (!v) return false
      if (key === 'ae_present') {
        const lower = v.toLowerCase()
        return lower === 'yes' || lower === 'true' || lower === '1'
      }
      return v.trim().length > 0
    })
    const term = values.get('ae_term')
    if (!hasAeSignal && !term) continue

    const visitId = set.visit_id as string
    const procId = set.procedure_execution_id as string
    const seriousness = parseSeriousness(values)
    const severity = values.get('ae_severity') ?? values.get('severity') ?? null
    const relationship =
      values.get('relationship_to_ip') ?? values.get('relatedness') ?? null
    const onset =
      values.get('onset_date') ?? values.get('ae_start_date') ?? null
    const resolution = values.get('ae_end_date') ?? null
    const outcome = values.get('outcome') ?? values.get('ae_outcome') ?? null
    const setStatus = set.status as string

    items.push({
      id: `source-ae-${setId}`,
      sourceKind: 'source_capture',
      eventTerm: term ?? 'Adverse event (source capture)',
      preferredTerm: term ?? null,
      severity,
      seriousness,
      relationship,
      lifecycleStatus: deriveCaptureLifecycle(setStatus, false),
      onsetDate: onset,
      resolutionDate: resolution ?? (outcome?.toLowerCase().includes('resolved') ? onset : null),
      visitId,
      visitLabel: visitLabelById.get(visitId) ?? null,
      sourceAttribution: 'Source capture',
      lastUpdatedAt: set.updated_at as string,
      reporter: null,
      isSeriousAdverseEvent: seriousness,
      href: visitDetailPath(visitId),
      captureHref: sourceCapturePath(procId, input.organizationId),
      reviewHref: sourceResponseSetPath(setId, { organization_id: input.organizationId }),
    })
  }

  return items
}
