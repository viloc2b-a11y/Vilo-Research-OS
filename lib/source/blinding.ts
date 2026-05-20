import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApiEnvelope } from '@/lib/api/source/types'
import type {
  FindingsListData,
  HistoryData,
  ResponseSetDetailData,
  ResponseSetFieldRow,
} from '@/lib/api/source/read-types'
import type { BlindingScope } from '@/lib/rbac/blinding'
import { canManageUnblindedData, canViewUnblindedData } from '@/lib/rbac/permissions'
import type { OrganizationMembership } from '@/lib/auth/session'

export type SourceFieldBlindingInfo = {
  fieldId: string
  fieldKey: string
  blindingScope: BlindingScope
}

const SENSITIVE_FIELD_KEY_PATTERNS = [
  /(^|_)ip(_|$)/i,
  /kit/i,
  /treatment/i,
  /randomization/i,
  /randomisation/i,
  /study_arm/i,
  /(^|_)arm($|_)/i,
  /allocation/i,
]

function normalizeBlindingScope(value: unknown): BlindingScope {
  if (value === 'unblinded' || value === 'public_to_site' || value === 'blinded') return value
  return 'blinded'
}

export function inferSourceFieldBlindingScope(input: {
  fieldKey?: string | null
  blindingScope?: unknown
}): BlindingScope {
  const explicit = normalizeBlindingScope(input.blindingScope)
  if (explicit === 'unblinded' || explicit === 'public_to_site') return explicit
  const fieldKey = input.fieldKey ?? ''
  return SENSITIVE_FIELD_KEY_PATTERNS.some((pattern) => pattern.test(fieldKey))
    ? 'unblinded'
    : 'blinded'
}

export function isUnblindedSourceField(input: {
  fieldKey?: string | null
  blindingScope?: unknown
}): boolean {
  return inferSourceFieldBlindingScope(input) === 'unblinded'
}

type SourceFieldMetadataRow = {
  id: string
  field_key: string | null
  blinding_scope?: string | null
}

export async function loadSourceFieldBlindingMap(
  supabase: SupabaseClient,
  fieldIds: string[],
): Promise<Map<string, SourceFieldBlindingInfo>> {
  const ids = [...new Set(fieldIds.filter(Boolean))]
  const map = new Map<string, SourceFieldBlindingInfo>()
  if (ids.length === 0) return map

  const withScope = await supabase
    .from('source_fields')
    .select('id, field_key, blinding_scope')
    .in('id', ids)

  let rows = withScope.data as SourceFieldMetadataRow[] | null
  if (withScope.error && /blinding_scope/i.test(withScope.error.message)) {
    const fallback = await supabase
      .from('source_fields')
      .select('id, field_key')
      .in('id', ids)
    rows = fallback.data as SourceFieldMetadataRow[] | null
  }

  for (const row of rows ?? []) {
    const fieldKey = row.field_key ?? ''
    map.set(row.id, {
      fieldId: row.id,
      fieldKey,
      blindingScope: inferSourceFieldBlindingScope({
        fieldKey,
        blindingScope: row.blinding_scope,
      }),
    })
  }
  return map
}

export function filterSourceFieldsForBlinding<T extends {
  source_field_id: string
  field_key?: string | null
  blinding_scope?: unknown
}>(
  fields: T[],
  canViewUnblinded: boolean,
): T[] {
  if (canViewUnblinded) return fields
  return fields.filter((field) => !isUnblindedSourceField({
    fieldKey: field.field_key,
    blindingScope: field.blinding_scope,
  }))
}

export function filterResponseSetDetailForBlinding(
  data: ResponseSetDetailData,
  canViewUnblinded: boolean,
): ResponseSetDetailData {
  if (canViewUnblinded) return data

  const visibleFields = filterSourceFieldsForBlinding(data.fields, false)
  const visibleFieldIds = new Set(visibleFields.map((field) => field.source_field_id))
  const hiddenResponseIds = new Set<string>()
  for (const field of data.fields) {
    if (visibleFieldIds.has(field.source_field_id)) continue
    for (const history of field.history ?? []) hiddenResponseIds.add(history.response_id)
    if (field.current_effective?.response_id) {
      hiddenResponseIds.add(field.current_effective.response_id)
    }
  }

  const activeFindings = data.findings_summary.active.filter((row) =>
    !row.response_id || !hiddenResponseIds.has(row.response_id),
  )
  const severityCounts = { info: 0, warning: 0, error: 0 }
  for (const finding of activeFindings) {
    if (finding.severity === 'warning') severityCounts.warning += 1
    else if (finding.severity === 'error') severityCounts.error += 1
    else severityCounts.info += 1
  }

  return {
    ...data,
    fields: visibleFields,
    corrections: data.corrections.filter((row) => visibleFieldIds.has(row.source_field_id)),
    addenda: data.addenda.filter((row) => visibleFieldIds.has(row.introduced_source_field_id)),
    findings_summary: {
      ...data.findings_summary,
      active: activeFindings,
      counts: {
        total: activeFindings.length,
        open: activeFindings.filter((row) => row.status === 'open').length,
        acknowledged: activeFindings.filter((row) => row.status === 'acknowledged').length,
        resolved: activeFindings.filter((row) => row.status === 'resolved').length,
        waived: activeFindings.filter((row) => row.status === 'waived').length,
        severity: severityCounts,
      },
    },
  }
}

export async function attachFieldBlindingToDetail(
  supabase: SupabaseClient,
  data: ResponseSetDetailData,
): Promise<ResponseSetDetailData> {
  const blindingMap = await loadSourceFieldBlindingMap(
    supabase,
    data.fields.map((field) => field.source_field_id),
  )
  return {
    ...data,
    fields: data.fields.map((field) => ({
      ...field,
      blinding_scope:
        blindingMap.get(field.source_field_id)?.blindingScope
        ?? inferSourceFieldBlindingScope({
          fieldKey: field.field_key,
          blindingScope: field.blinding_scope,
        }),
    })),
  }
}

function eventReferencesHiddenField(
  event: { payload: Record<string, unknown> },
  hiddenFieldIds: Set<string>,
  hiddenResponseIds: Set<string>,
): boolean {
  const payload = event.payload ?? {}
  const fieldId = payload.source_field_id
  const introducedFieldId = payload.introduced_source_field_id
  const responseId = payload.source_response_id ?? payload.response_id
  return (
    (typeof fieldId === 'string' && hiddenFieldIds.has(fieldId))
    || (typeof introducedFieldId === 'string' && hiddenFieldIds.has(introducedFieldId))
    || (typeof responseId === 'string' && hiddenResponseIds.has(responseId))
  )
}

export function filterHistoryForBlinding(
  history: HistoryData,
  detail: ResponseSetDetailData | null,
  canViewUnblinded: boolean,
): HistoryData {
  if (canViewUnblinded || !detail) return history
  const hiddenFieldIds = new Set<string>()
  const hiddenResponseIds = new Set<string>()
  for (const field of detail.fields) {
    if (!isUnblindedSourceField({ fieldKey: field.field_key, blindingScope: field.blinding_scope })) {
      continue
    }
    hiddenFieldIds.add(field.source_field_id)
    for (const row of field.history ?? []) hiddenResponseIds.add(row.response_id)
    if (field.current_effective?.response_id) hiddenResponseIds.add(field.current_effective.response_id)
  }
  const visibleEvents = history.events.filter((event) =>
    !eventReferencesHiddenField(event, hiddenFieldIds, hiddenResponseIds),
  )
  return {
    ...history,
    event_count: visibleEvents.length,
    events: visibleEvents,
  }
}

export function filterFindingsForBlinding(
  findings: FindingsListData,
  detail: ResponseSetDetailData | null,
  canViewUnblinded: boolean,
): FindingsListData {
  if (canViewUnblinded || !detail) return findings
  const hiddenFieldIds = new Set(
    detail.fields
      .filter((field) => isUnblindedSourceField({
        fieldKey: field.field_key,
        blindingScope: field.blinding_scope,
      }))
      .map((field) => field.source_field_id),
  )
  const filtered = findings.findings.filter((row) =>
    !row.source_field_id || !hiddenFieldIds.has(row.source_field_id),
  )
  return {
    ...findings,
    findings: filtered,
    counts: { returned: filtered.length, total_in_set: filtered.length },
  }
}

export function sourceEnvelopeWithData<T>(
  envelope: ApiEnvelope<T>,
  data: T,
): ApiEnvelope<T> {
  return { ...envelope, data }
}

export function userCanViewUnblindedSource(
  memberships: OrganizationMembership[],
  organizationId: string,
): boolean {
  return canViewUnblindedData(memberships, organizationId)
}

export function userCanManageUnblindedSource(
  memberships: OrganizationMembership[],
  organizationId: string,
): boolean {
  return canManageUnblindedData(memberships, organizationId)
}

export async function responseItemsContainUnblindedFields(
  supabase: SupabaseClient,
  fieldIds: string[],
): Promise<boolean> {
  const blindingMap = await loadSourceFieldBlindingMap(supabase, fieldIds)
  return [...blindingMap.values()].some((field) => field.blindingScope === 'unblinded')
}

export async function responseSetHasCurrentUnblindedDrafts(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    responseSetId: string
  },
): Promise<boolean> {
  const { data, error } = await supabase
    .from('source_responses')
    .select('source_field_id')
    .eq('organization_id', input.organizationId)
    .eq('response_set_id', input.responseSetId)
    .eq('is_current', true)
    .eq('is_submitted', false)

  if (error || !data?.length) return false
  return responseItemsContainUnblindedFields(
    supabase,
    data.map((row) => row.source_field_id as string),
  )
}

export async function responseSetHasUnblindedSourceFields(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    responseSetId?: string | null
    procedureExecutionId?: string | null
  },
): Promise<boolean> {
  let responseSetId = input.responseSetId ?? null
  if (!responseSetId && input.procedureExecutionId) {
    const { data, error } = await supabase
      .from('source_response_sets')
      .select('id')
      .eq('organization_id', input.organizationId)
      .eq('procedure_execution_id', input.procedureExecutionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data?.id) return false
    responseSetId = data.id as string
  }

  if (!responseSetId) return false

  const { data: responseRows, error: responseError } = await supabase
    .from('source_responses')
    .select('source_field_id')
    .eq('organization_id', input.organizationId)
    .eq('response_set_id', responseSetId)

  if (responseError) return false
  const responseFieldIds = (responseRows ?? [])
    .map((row) => row.source_field_id as string | null)
    .filter((id): id is string => Boolean(id))

  if (responseFieldIds.length > 0 && await responseItemsContainUnblindedFields(supabase, responseFieldIds)) {
    return true
  }

  const { data: setRow, error: setError } = await supabase
    .from('source_response_sets')
    .select('source_definition_version_id')
    .eq('organization_id', input.organizationId)
    .eq('id', responseSetId)
    .maybeSingle()

  if (setError || !setRow?.source_definition_version_id) return false

  const { data: fieldRows, error: fieldError } = await supabase
    .from('source_fields')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('source_definition_version_id', setRow.source_definition_version_id as string)

  if (fieldError || !fieldRows?.length) return false
  return responseItemsContainUnblindedFields(
    supabase,
    fieldRows.map((row) => row.id as string),
  )
}

export async function sourceResponseIsUnblinded(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    sourceResponseId: string
  },
): Promise<boolean> {
  const { data, error } = await supabase
    .from('source_responses')
    .select('source_field_id')
    .eq('organization_id', input.organizationId)
    .eq('id', input.sourceResponseId)
    .maybeSingle()

  if (error || !data?.source_field_id) return false
  return responseItemsContainUnblindedFields(supabase, [data.source_field_id as string])
}

export function fieldRowBlindingScope(field: ResponseSetFieldRow): BlindingScope {
  return inferSourceFieldBlindingScope({
    fieldKey: field.field_key,
    blindingScope: field.blinding_scope,
  })
}
