/**
 * Phase 5.1A — Request body validation (shape only; no integrity rules).
 */

import { apiError } from '@/lib/api/source/errors'
import type { ApiError } from '@/lib/api/source/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function invalid(errors: string[]): { ok: false; errors: ApiError[] } {
  return {
    ok: false,
    errors: errors.map((message) => apiError('INVALID_REQUEST', message)),
  }
}

function requireUuid(value: unknown, field: string, errors: string[]) {
  if (!isUuid(value)) errors.push(`${field} must be a UUID`)
}

export type OpenRequestBody = {
  organization_id: string
  study_id: string
  study_version_id: string
  study_subject_id: string
  visit_id: string
  procedure_execution_id: string
  source_definition_version_id: string
}

export function parseOpenBody(body: unknown):
  | { ok: true; data: OpenRequestBody }
  | { ok: false; errors: ApiError[] } {
  if (!body || typeof body !== 'object') {
    return invalid(['Request body must be a JSON object'])
  }
  const o = body as Record<string, unknown>
  const errors: string[] = []
  requireUuid(o.organization_id, 'organization_id', errors)
  requireUuid(o.study_id, 'study_id', errors)
  requireUuid(o.study_version_id, 'study_version_id', errors)
  requireUuid(o.study_subject_id, 'study_subject_id', errors)
  requireUuid(o.visit_id, 'visit_id', errors)
  requireUuid(o.procedure_execution_id, 'procedure_execution_id', errors)
  requireUuid(o.source_definition_version_id, 'source_definition_version_id', errors)
  if (errors.length) return invalid(errors)
  return {
    ok: true,
    data: {
      organization_id: o.organization_id as string,
      study_id: o.study_id as string,
      study_version_id: o.study_version_id as string,
      study_subject_id: o.study_subject_id as string,
      visit_id: o.visit_id as string,
      procedure_execution_id: o.procedure_execution_id as string,
      source_definition_version_id: o.source_definition_version_id as string,
    },
  }
}

export type DraftResponseItem = {
  source_field_id: string
  value_text?: string
  value_number?: number
  value_boolean?: boolean
  value_date?: string
  value_datetime?: string
  value_json?: unknown
  comments?: string
}

export type SaveDraftRequestBody = {
  organization_id: string
  source_response_set_id: string
  responses: DraftResponseItem[]
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function parseSaveDraftBody(body: unknown):
  | { ok: true; data: SaveDraftRequestBody }
  | { ok: false; errors: ApiError[] } {
  if (!body || typeof body !== 'object') {
    return invalid(['Request body must be a JSON object'])
  }
  const o = body as Record<string, unknown>
  const errors: string[] = []
  requireUuid(o.organization_id, 'organization_id', errors)
  requireUuid(o.source_response_set_id, 'source_response_set_id', errors)
  if (!Array.isArray(o.responses)) {
    errors.push('responses must be an array')
  } else {
    o.responses.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`responses[${index}] must be an object`)
        return
      }
      const row = item as Record<string, unknown>
      requireUuid(row.source_field_id, `responses[${index}].source_field_id`, errors)
      if (row.value_text !== undefined && typeof row.value_text !== 'string') {
        errors.push(`responses[${index}].value_text must be a string`)
      }
      if (row.value_number !== undefined && typeof row.value_number !== 'number') {
        errors.push(`responses[${index}].value_number must be a number`)
      }
      if (row.value_boolean !== undefined && typeof row.value_boolean !== 'boolean') {
        errors.push(`responses[${index}].value_boolean must be a boolean`)
      }
      if (row.value_date !== undefined) {
        if (typeof row.value_date !== 'string' || !isIsoDate(row.value_date)) {
          errors.push(`responses[${index}].value_date must be YYYY-MM-DD`)
        }
      }
      if (row.value_datetime !== undefined && typeof row.value_datetime !== 'string') {
        errors.push(`responses[${index}].value_datetime must be a string`)
      }
      if (row.comments !== undefined && typeof row.comments !== 'string') {
        errors.push(`responses[${index}].comments must be a string`)
      }
    })
  }
  if (errors.length) return invalid(errors)

  const responses = (o.responses as Record<string, unknown>[]).map((row) => {
    const item: DraftResponseItem = { source_field_id: row.source_field_id as string }
    if (row.value_text !== undefined) item.value_text = row.value_text as string
    if (row.value_number !== undefined) item.value_number = row.value_number as number
    if (row.value_boolean !== undefined) item.value_boolean = row.value_boolean as boolean
    if (row.value_date !== undefined) item.value_date = row.value_date as string
    if (row.value_datetime !== undefined) item.value_datetime = row.value_datetime as string
    if (row.value_json !== undefined) item.value_json = row.value_json
    if (row.comments !== undefined) item.comments = row.comments as string
    return item
  })

  return {
    ok: true,
    data: {
      organization_id: o.organization_id as string,
      source_response_set_id: o.source_response_set_id as string,
      responses,
    },
  }
}

export type SubmitRequestBody = {
  organization_id: string
  source_response_set_id: string
  submit_reason: string | null
}

export function parseSubmitBody(body: unknown):
  | { ok: true; data: SubmitRequestBody }
  | { ok: false; errors: ApiError[] } {
  if (!body || typeof body !== 'object') {
    return invalid(['Request body must be a JSON object'])
  }
  const o = body as Record<string, unknown>
  const errors: string[] = []
  requireUuid(o.organization_id, 'organization_id', errors)
  requireUuid(o.source_response_set_id, 'source_response_set_id', errors)
  if (o.submit_reason !== undefined && o.submit_reason !== null && typeof o.submit_reason !== 'string') {
    errors.push('submit_reason must be a string when provided')
  }
  if (errors.length) return invalid(errors)
  return {
    ok: true,
    data: {
      organization_id: o.organization_id as string,
      source_response_set_id: o.source_response_set_id as string,
      submit_reason:
        o.submit_reason === undefined || o.submit_reason === null
          ? null
          : (o.submit_reason as string),
    },
  }
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function requireNonEmptyString(value: unknown, field: string, errors: string[]) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string`)
  }
}

function requireObject(value: unknown, field: string, errors: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${field} must be a JSON object`)
  }
}

export type CorrectRequestBody = {
  organization_id: string
  source_response_id: string
  corrected_value: Record<string, unknown>
  correction_reason: string
}

export function parseCorrectBody(body: unknown):
  | { ok: true; data: CorrectRequestBody }
  | { ok: false; errors: ApiError[] } {
  if (!body || typeof body !== 'object') {
    return invalid(['Request body must be a JSON object'])
  }
  const o = body as Record<string, unknown>
  const errors: string[] = []
  requireUuid(o.organization_id, 'organization_id', errors)
  requireUuid(o.source_response_id, 'source_response_id', errors)
  requireObject(o.corrected_value, 'corrected_value', errors)
  const reason =
    typeof o.correction_reason === 'string'
      ? o.correction_reason
      : typeof o.reason === 'string'
        ? o.reason
        : null
  if (!reason || reason.trim().length === 0) {
    errors.push('correction_reason must be a non-empty string')
  }
  if (errors.length) return invalid(errors)
  return {
    ok: true,
    data: {
      organization_id: o.organization_id as string,
      source_response_id: o.source_response_id as string,
      corrected_value: o.corrected_value as Record<string, unknown>,
      correction_reason: reason!.trim(),
    },
  }
}

export type AddendumRequestBody = {
  organization_id: string
  source_response_set_id: string
  source_field_id: string
  value: Record<string, unknown>
  reason: string
  introduced_by_source_definition_version_id: string | null
}

export function parseAddendumBody(body: unknown):
  | { ok: true; data: AddendumRequestBody }
  | { ok: false; errors: ApiError[] } {
  if (!body || typeof body !== 'object') {
    return invalid(['Request body must be a JSON object'])
  }
  const o = body as Record<string, unknown>
  const errors: string[] = []
  requireUuid(o.organization_id, 'organization_id', errors)
  const responseSetId = o.source_response_set_id ?? o.response_set_id
  requireUuid(responseSetId, 'source_response_set_id', errors)
  requireUuid(o.source_field_id, 'source_field_id', errors)

  let value: Record<string, unknown> | null = null
  if (o.structured_payload !== undefined) {
    if (!o.structured_payload || typeof o.structured_payload !== 'object' || Array.isArray(o.structured_payload)) {
      errors.push('structured_payload must be a JSON object')
    } else {
      value = o.structured_payload as Record<string, unknown>
    }
  } else if (o.value !== undefined) {
    requireObject(o.value, 'value', errors)
    if (!errors.length) value = o.value as Record<string, unknown>
  } else if (typeof o.addendum_text === 'string' && o.addendum_text.trim().length > 0) {
    value = { value_text: o.addendum_text.trim() }
  }

  if (!value) {
    errors.push('structured_payload, value, or addendum_text is required')
  }

  const reasonRaw =
    typeof o.reason === 'string'
      ? o.reason
      : typeof o.context === 'string'
        ? o.context
        : typeof o.addendum_text === 'string' && value?.value_text
          ? o.addendum_text
          : null
  if (!reasonRaw || reasonRaw.trim().length === 0) {
    errors.push('reason, context, or addendum_text is required')
  }

  if (o.introduced_by_source_definition_version_id !== undefined && o.introduced_by_source_definition_version_id !== null) {
    requireUuid(o.introduced_by_source_definition_version_id, 'introduced_by_source_definition_version_id', errors)
  }

  if (errors.length) return invalid(errors)

  return {
    ok: true,
    data: {
      organization_id: o.organization_id as string,
      source_response_set_id: responseSetId as string,
      source_field_id: o.source_field_id as string,
      value: value!,
      reason: reasonRaw!.trim(),
      introduced_by_source_definition_version_id:
        o.introduced_by_source_definition_version_id === undefined ||
        o.introduced_by_source_definition_version_id === null
          ? null
          : (o.introduced_by_source_definition_version_id as string),
    },
  }
}

export type CreateFindingRequestBody = {
  organization_id: string
  source_response_set_id: string
  finding_type: string
  severity: string
  message: string
  source_response_id: string | null
  source_field_id: string | null
  rule_reference: string | null
}

export function parseCreateFindingBody(body: unknown):
  | { ok: true; data: CreateFindingRequestBody }
  | { ok: false; errors: ApiError[] } {
  if (!body || typeof body !== 'object') {
    return invalid(['Request body must be a JSON object'])
  }
  const o = body as Record<string, unknown>
  const errors: string[] = []
  requireUuid(o.organization_id, 'organization_id', errors)
  const responseSetId = o.source_response_set_id ?? o.response_set_id
  requireUuid(responseSetId, 'source_response_set_id', errors)
  requireNonEmptyString(o.finding_type, 'finding_type', errors)
  requireNonEmptyString(o.severity, 'severity', errors)

  const message =
    typeof o.finding_text === 'string'
      ? o.finding_text
      : typeof o.message === 'string'
        ? o.message
        : null
  if (!message || message.trim().length === 0) {
    errors.push('finding_text must be a non-empty string')
  }

  if (o.source_response_id !== undefined && o.source_response_id !== null) {
    requireUuid(o.source_response_id, 'source_response_id', errors)
  }
  if (o.source_field_id !== undefined && o.source_field_id !== null) {
    requireUuid(o.source_field_id, 'source_field_id', errors)
  }
  if (o.rule_reference !== undefined && o.rule_reference !== null && typeof o.rule_reference !== 'string') {
    errors.push('rule_reference must be a string when provided')
  }

  if (errors.length) return invalid(errors)

  return {
    ok: true,
    data: {
      organization_id: o.organization_id as string,
      source_response_set_id: responseSetId as string,
      finding_type: (o.finding_type as string).trim(),
      severity: (o.severity as string).trim(),
      message: message!.trim(),
      source_response_id:
        o.source_response_id === undefined || o.source_response_id === null
          ? null
          : (o.source_response_id as string),
      source_field_id:
        o.source_field_id === undefined || o.source_field_id === null
          ? null
          : (o.source_field_id as string),
      rule_reference:
        o.rule_reference === undefined || o.rule_reference === null
          ? null
          : String(o.rule_reference).trim(),
    },
  }
}

export type FindingActionRequestBody = {
  organization_id: string
  finding_id: string
  comment: string | null
}

export function parseWaiveBody(body: unknown):
  | { ok: true; data: FindingActionRequestBody }
  | { ok: false; errors: ApiError[] } {
  const parsed = parseFindingActionBody(body, { commentField: 'waiver_reason' })
  if (!parsed.ok) return parsed
  if (!parsed.data.comment) {
    return invalid(['waiver_reason must be a non-empty string'])
  }
  return parsed
}

export function parseFindingActionBody(
  body: unknown,
  options?: { commentField?: 'comment' | 'resolution_text' | 'waiver_reason' },
): { ok: true; data: FindingActionRequestBody } | { ok: false; errors: ApiError[] } {
  if (!body || typeof body !== 'object') {
    return invalid(['Request body must be a JSON object'])
  }
  const o = body as Record<string, unknown>
  const errors: string[] = []
  requireUuid(o.organization_id, 'organization_id', errors)
  requireUuid(o.finding_id, 'finding_id', errors)

  const preferred = options?.commentField ?? 'comment'
  let comment: string | null = null
  if (typeof o[preferred] === 'string') comment = o[preferred] as string
  else if (typeof o.comment === 'string') comment = o.comment as string
  else if (typeof o.resolution_text === 'string') comment = o.resolution_text as string
  else if (typeof o.waiver_reason === 'string') comment = o.waiver_reason as string

  if (comment !== null && comment.trim().length === 0) {
    errors.push(`${preferred} must be non-empty when provided`)
  }

  if (errors.length) return invalid(errors)

  return {
    ok: true,
    data: {
      organization_id: o.organization_id as string,
      finding_id: o.finding_id as string,
      comment: comment === null ? null : comment.trim(),
    },
  }
}

export type HistoryQueryParams = {
  organization_id: string
  source_response_set_id: string
  limit: number | null
  cursor: string | null
}

export type ResponseSetReadQueryParams = {
  organization_id: string
  source_response_set_id: string
}

export function parseResponseSetReadQuery(
  sourceResponseSetId: string,
  searchParams: URLSearchParams,
): { ok: true; data: ResponseSetReadQueryParams } | { ok: false; errors: ApiError[] } {
  const errors: string[] = []
  if (!isUuid(sourceResponseSetId)) {
    errors.push('response set id path parameter must be a UUID')
  }
  const organizationId = searchParams.get('organization_id')
  requireUuid(organizationId, 'organization_id query parameter', errors)
  if (errors.length) return invalid(errors)
  return {
    ok: true,
    data: {
      organization_id: organizationId as string,
      source_response_set_id: sourceResponseSetId,
    },
  }
}

export type FindingsListQueryParams = ResponseSetReadQueryParams & {
  active_only: boolean
  status: string | null
  severity: string | null
}

const FINDING_STATUS_VALUES = new Set(['open', 'acknowledged', 'resolved', 'waived'])
const FINDING_SEVERITY_VALUES = new Set(['info', 'warning', 'error'])

export function parseFindingsListQuery(
  sourceResponseSetId: string,
  searchParams: URLSearchParams,
): { ok: true; data: FindingsListQueryParams } | { ok: false; errors: ApiError[] } {
  const base = parseResponseSetReadQuery(sourceResponseSetId, searchParams)
  if (!base.ok) return base

  const errors: string[] = []
  const activeRaw = searchParams.get('active_only')
  let activeOnly = false
  if (activeRaw !== null && activeRaw !== '') {
    if (activeRaw === 'true' || activeRaw === '1') activeOnly = true
    else if (activeRaw === 'false' || activeRaw === '0') activeOnly = false
    else errors.push('active_only must be true, false, 1, or 0 when provided')
  }

  const status = searchParams.get('status')
  if (status !== null && status !== '') {
    if (!FINDING_STATUS_VALUES.has(status)) {
      errors.push('status must be open, acknowledged, resolved, or waived')
    }
  }

  const severity = searchParams.get('severity')
  if (severity !== null && severity !== '') {
    if (!FINDING_SEVERITY_VALUES.has(severity)) {
      errors.push('severity must be info, warning, or error')
    }
  }

  if (errors.length) return invalid(errors)

  return {
    ok: true,
    data: {
      ...base.data,
      active_only: activeOnly,
      status: status && status.length > 0 ? status : null,
      severity: severity && severity.length > 0 ? severity : null,
    },
  }
}

export function parseHistoryQuery(
  sourceResponseSetId: string,
  searchParams: URLSearchParams,
): { ok: true; data: HistoryQueryParams } | { ok: false; errors: ApiError[] } {
  const errors: string[] = []
  if (!isUuid(sourceResponseSetId)) {
    errors.push('response set id path parameter must be a UUID')
  }
  const organizationId = searchParams.get('organization_id')
  requireUuid(organizationId, 'organization_id query parameter', errors)

  let limit: number | null = null
  const limitRaw = searchParams.get('limit')
  if (limitRaw !== null && limitRaw !== '') {
    const n = Number(limitRaw)
    if (!Number.isFinite(n) || n < 1) {
      errors.push('limit must be a positive number when provided')
    } else {
      limit = Math.floor(n)
    }
  }

  const cursor = searchParams.get('cursor')
  if (cursor !== null && cursor !== '' && typeof cursor !== 'string') {
    errors.push('cursor must be a string when provided')
  }

  if (errors.length) return invalid(errors)

  return {
    ok: true,
    data: {
      organization_id: organizationId as string,
      source_response_set_id: sourceResponseSetId,
      limit,
      cursor: cursor && cursor.length > 0 ? cursor : null,
    },
  }
}
