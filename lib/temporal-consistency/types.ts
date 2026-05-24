/**
 * Phase 16A-2.5 — Temporal consistency types.
 */

import type {
  TemporalConstraintType,
  TemporalEvaluationResult,
  TemporalRuleScope,
  TemporalSeverity,
} from '@/lib/temporal-consistency/constants'
import type { WorkflowKey } from '@/lib/governance/workflow-authority/constants'

export type TemporalConsistencyRule = {
  id: string
  organizationId: string | null
  ruleKey: string
  scope: TemporalRuleScope
  studyVersionId: string | null
  eventAType: string
  eventAField: string
  eventBType: string
  eventBField: string
  constraintType: TemporalConstraintType
  windowHours: number | null
  severity: TemporalSeverity
  workflowKey: WorkflowKey | null
  regulated: boolean
  auditRequired: boolean
  systemBlocking: boolean
  active: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type TemporalConsistencyEvaluateInput = {
  rule: Pick<
    TemporalConsistencyRule,
    'ruleKey' | 'constraintType' | 'severity' | 'systemBlocking'
  >
  eventAValue: string | Date | null | undefined
  eventBValue: string | Date | null | undefined
  /** When true and rule fails with blocker severity + system_blocking, result may be blocked. */
  enforce?: boolean
}

export type TemporalConsistencyEvaluateOutcome = {
  evaluationResult: TemporalEvaluationResult
  severity: TemporalSeverity
  eventAValue: string | null
  eventBValue: string | null
  reason: string | null
}

export type TemporalConsistencyEvaluationInsert = {
  organizationId: string
  studyId?: string | null
  studyVersionId?: string | null
  studySubjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  ruleId?: string | null
  ruleKey: string
  evaluationResult: TemporalEvaluationResult
  severity: TemporalSeverity
  eventAValue?: string | null
  eventBValue?: string | null
  evidenceRefs?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type TemporalConsistencyEvaluationRecord = TemporalConsistencyEvaluationInsert & {
  id: string
  sourceOperationalEventId: string | null
  evaluatedAt: string
}
