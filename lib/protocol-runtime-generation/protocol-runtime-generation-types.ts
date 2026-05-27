export const GENERATION_STATUS = {
  DRAFT: 'draft',
  VALIDATED: 'validated',
  GENERATED: 'generated',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export type GenerationStatus = (typeof GENERATION_STATUS)[keyof typeof GENERATION_STATUS]

export const GENERATION_EVENT_TYPE = {
  VALIDATED: 'generation_validated',
  FAILED: 'generation_failed',
  RUNTIME_VISITS_CREATED: 'runtime_visits_created',
  STUDY_BLUEPRINTS_ASSIGNED: 'study_blueprints_assigned',
  VISIT_PROCEDURES_CREATED: 'visit_procedures_created',
  RUNTIME_GRAPH_COMPILED: 'runtime_graph_compiled',
  COMPLETED: 'generation_completed',
  CANCELLED: 'generation_cancelled',
} as const

export type GenerationEventType = (typeof GENERATION_EVENT_TYPE)[keyof typeof GENERATION_EVENT_TYPE]

export type ProtocolRuntimeGenerationRunRow = {
  id: string
  organizationId: string
  protocolVersionId: string
  protocolRuntimeStudyId: string
  studyId: string
  generationStatus: GenerationStatus
  generatedRuntimeSnapshotId: string | null
  generatedBy: string
  generatedAt: string | null
  sourceSummary: Record<string, unknown>
  resultSummary: Record<string, unknown>
  validationErrors: Array<Record<string, unknown>>
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type ProtocolRuntimeGenerationEventRow = {
  id: string
  organizationId: string
  generationRunId: string
  protocolVersionId: string
  eventType: GenerationEventType
  actorId: string | null
  eventTimestamp: string
  eventPayload: Record<string, unknown>
  stateHash: string
  metadata: Record<string, unknown>
}

export type ApprovedReconciliationVisit = {
  id: string
  visitCode: string
  visitName: string
  visitType: string | null
  studyDay: number | null
  windowBeforeDays: number | null
  windowAfterDays: number | null
}

export type ApprovedReconciliationProcedure = {
  id: string
  visitReconciliationId: string
  procedureName: string
  procedureCategory: string | null
  procedureOrder: number | null
  required: boolean
  matchedProcedureLibraryId: string
  matchedBlueprintVersionId: string
  matchConfidence: number | null
  operationalOverrides: Record<string, unknown>
}

export type LoadedApprovedReconciliation = {
  organizationId: string
  protocolVersionId: string
  protocolRuntimeStudyId: string
  studyId: string
  visits: ApprovedReconciliationVisit[]
  procedures: ApprovedReconciliationProcedure[]
}

export type ValidationError = {
  code: string
  message: string
  scope?: 'visit' | 'procedure' | 'study' | 'protocol'
  record_id?: string
  metadata?: Record<string, unknown>
}

export type ValidateGenerationReadinessResult = {
  ok: boolean
  errors: ValidationError[]
  summary: Record<string, unknown>
}

export type CreateGenerationRunInput = {
  organization_id: string
  protocol_version_id: string
  protocol_runtime_study_id: string
  study_id: string
}

export type CreateGenerationRunResult = {
  run: ProtocolRuntimeGenerationRunRow
}

export type GenerateStudyRuntimeResult = {
  generationRunId: string
  runtimeSnapshotId: string
  summary: Record<string, unknown>
}

export function mapGenerationRunRow(row: Record<string, unknown>): ProtocolRuntimeGenerationRunRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    protocolVersionId: String(row.protocol_version_id),
    protocolRuntimeStudyId: String(row.protocol_runtime_study_id),
    studyId: String(row.study_id),
    generationStatus: row.generation_status as GenerationStatus,
    generatedRuntimeSnapshotId: row.generated_runtime_snapshot_id
      ? String(row.generated_runtime_snapshot_id)
      : null,
    generatedBy: String(row.generated_by),
    generatedAt: row.generated_at ? String(row.generated_at) : null,
    sourceSummary: (row.source_summary ?? {}) as Record<string, unknown>,
    resultSummary: (row.result_summary ?? {}) as Record<string, unknown>,
    validationErrors: (row.validation_errors ?? []) as Array<Record<string, unknown>>,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapGenerationEventRow(
  row: Record<string, unknown>,
): ProtocolRuntimeGenerationEventRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    generationRunId: String(row.generation_run_id),
    protocolVersionId: String(row.protocol_version_id),
    eventType: row.event_type as GenerationEventType,
    actorId: row.actor_id ? String(row.actor_id) : null,
    eventTimestamp: String(row.event_timestamp),
    eventPayload: (row.event_payload ?? {}) as Record<string, unknown>,
    stateHash: String(row.state_hash),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  }
}

