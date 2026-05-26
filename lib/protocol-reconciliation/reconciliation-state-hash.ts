import { createHash } from 'crypto'
import type {
  ProtocolProcedureReconciliationRow,
  ProtocolVisitReconciliationRow,
} from './protocol-reconciliation-types'

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`
}

export function buildVisitReconciliationStateSnapshot(row: ProtocolVisitReconciliationRow) {
  return {
    id: row.id,
    protocol_version_id: row.protocolVersionId,
    visit_code: row.visitCode,
    visit_name: row.visitName,
    visit_type: row.visitType,
    study_day: row.studyDay,
    window_before_days: row.windowBeforeDays,
    window_after_days: row.windowAfterDays,
    reconciliation_status: row.reconciliationStatus,
    reconciliation_source: row.reconciliationSource,
  }
}

export function buildProcedureReconciliationStateSnapshot(row: ProtocolProcedureReconciliationRow) {
  return {
    id: row.id,
    protocol_version_id: row.protocolVersionId,
    visit_reconciliation_id: row.visitReconciliationId,
    procedure_name: row.procedureName,
    procedure_category: row.procedureCategory,
    matched_procedure_library_id: row.matchedProcedureLibraryId,
    matched_blueprint_version_id: row.matchedBlueprintVersionId,
    match_confidence: row.matchConfidence,
    matching_method: row.matchingMethod,
    reconciliation_status: row.reconciliationStatus,
    reconciliation_source: row.reconciliationSource,
    required: row.required,
    procedure_order: row.procedureOrder,
  }
}

export function computeReconciliationStateHash(snapshot: Record<string, unknown>): string {
  return createHash('sha256').update(stableSerialize(snapshot)).digest('hex')
}
