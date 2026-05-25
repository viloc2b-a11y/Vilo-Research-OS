/**
 * Phase 5.0 — Source API shared types (contracts only; no routes).
 * @see docs/PHASE5-SOURCE-API-CONTRACTS.md
 */

/** Hard-block error codes — action must not succeed while present in `errors[]`. */
export const HARD_BLOCK_CODES = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INVALID_REQUEST',
  'SOURCE_DEFINITION_UNPUBLISHED',
  'FIELD_BINDING_INVALID',
  'VALUE_TYPE_INVALID',
  'REQUIRED_FIELD_MISSING',
  'SUBMITTED_VALUE_IMMUTABLE',
  'STALE_WRITE',
  'TENANT_SCOPE_VIOLATION',
  'LINEAGE_CONFLICT',
  'NOT_FOUND',
  'RPC_ERROR',
  'INTERNAL_ERROR',
] as const

export type HardBlockCode = (typeof HARD_BLOCK_CODES)[number]

/** Soft warning codes — visibility / follow-up; never set `ok: false` alone. */
export const WARNING_CODES = [
  'VISIT_OUT_OF_WINDOW',
  'PROCEDURE_NOT_PERFORMED',
  'PROCEDURE_LATE',
  'EXPECTED_LAB_MISSING',
  'EPRO_INCOMPLETE',
  'UNRESOLVED_FINDINGS',
  'EXPORT_READY_WITH_WARNINGS',
  'PROTOCOL_DEVIATION_RISK',
] as const

export type WarningCode = (typeof WARNING_CODES)[number]

export type ApiExportReadinessStatus =
  | 'ready'
  | 'ready_with_warnings'
  | 'not_ready_due_to_blockers'

export type ApiErrorContext = Record<string, unknown>

export type ApiWarningContext = Record<string, unknown>

export interface ApiError {
  code: HardBlockCode | string
  message: string
  field?: string | null
  source?: 'api' | 'rpc' | 'db'
  context?: ApiErrorContext | null
}

export interface ApiWarning {
  code: WarningCode | string
  message: string
  severity?: 'info' | 'warning' | 'error'
  field?: string | null
  source?: 'api' | 'integrity_read' | 'rpc'
  context?: ApiWarningContext | null
}

export interface ApiEnvelopePaginationMeta {
  limit: number | null
  cursor: string | null
  applied: boolean
}

export interface ApiEnvelopeMeta {
  requestId: string
  timestamp: string
  source: 'api'
  rpc?: string
  hardBlockCount: number
  warningCount: number
  projection?: string
  /** Reserved for future RPC-backed pagination; not applied until RPC supports it. */
  pagination?: ApiEnvelopePaginationMeta
}

export interface ApiEnvelope<T> {
  ok: boolean
  code: string
  data: T | null
  errors: ApiError[]
  warnings: ApiWarning[]
  meta: ApiEnvelopeMeta
}

/** Summarized finding row for reconciliation reads (Phase 5.0.x). */
export interface ApiFindingSummary {
  finding_id: string
  status: 'open' | 'acknowledged' | 'resolved' | 'waived' | string
  severity: 'info' | 'warning' | 'error' | string
  finding_type: string
  message: string
  source_field_id?: string | null
  source_response_id?: string | null
  rule_code?: string | null
  created_at?: string | null
}

/** Rollup for GET .../integrity (read-only composition; API does not adjudicate). */
export interface ApiIntegrityStatus {
  source_response_set_id: string
  visit_id?: string | null
  procedure_execution_id?: string | null
  set_status?: string | null
  visit_status?: string | null
  missing_required_fields: Array<{
    source_field_id: string
    field_key?: string | null
  }>
  missing_procedures: Array<{
    procedure_definition_id?: string | null
    code?: string | null
  }>
  out_of_window_visit: boolean
  late_procedures: Array<{ procedure_execution_id?: string | null; code?: string | null }>
  unresolved_findings: ApiFindingSummary[]
  protocol_deviation_risks: ApiWarning[]
}

/** Export gate classification — API surfaces backend/read rules; does not finalize deviation status. */
export interface ApiExportReadiness {
  status: ApiExportReadinessStatus
  blockers: ApiError[]
  warnings: ApiWarning[]
  sponsor_package_refs?: Array<{ package_id: string; persisted_at?: string | null }>
}

/** Typical Phase 4B/4C RPC JSON return shape. */
export interface RpcEnvelope<T = unknown> {
  ok?: boolean
  code?: string
  data?: T | null
  errors?: Array<{ code?: string; message?: string; field?: string; [key: string]: unknown }>
  warnings?: ApiWarning[]
  error?: string | null
  [key: string]: unknown
}

export interface EnvelopeBuildOptions {
  requestId?: string
  rpc?: string
  warnings?: ApiWarning[]
  code?: string
}
