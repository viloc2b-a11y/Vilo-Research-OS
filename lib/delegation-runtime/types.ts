/**
 * Phase 16A-2.5 — Delegation runtime check types.
 */

import type { DelegationCheckResult, DelegationRuntimeOutcome } from '@/lib/delegation-runtime/constants'
import type { WorkflowKey } from '@/lib/governance/workflow-authority/constants'

export type ProcedureDelegationRequirement = {
  id: string
  organizationId: string | null
  studyId: string | null
  studyVersionId: string | null
  procedureKey: string
  workflowKey: WorkflowKey | null
  requiresDelegation: boolean
  requiresPiDelegation: boolean
  regulated: boolean
  blockingIfMissing: boolean
  active: boolean
  notes: string | null
}

export type DelegationRuntimeCheckInput = {
  requirement: ProcedureDelegationRequirement | null
  delegated: boolean
  /** When true, PI-regulated procedures may return blocked per v0 rules. */
  enforce?: boolean
}

export type DelegationRuntimeCheckOutcome = {
  outcome: DelegationRuntimeOutcome
  checkResult: DelegationCheckResult
  requiresDelegation: boolean
  requiresPiDelegation: boolean
  regulated: boolean
  systemBlocking: boolean
  reason: string | null
}

export type DelegationRuntimeCheckRecordInput = {
  organizationId: string
  studyId?: string | null
  studyVersionId?: string | null
  actorUserId: string
  procedureKey?: string | null
  workflowKey?: WorkflowKey | null
  delegated: boolean
  checkResult: DelegationCheckResult
  requiresDelegation: boolean
  requiresPiDelegation: boolean
  regulated: boolean
  systemBlocking: boolean
  evidenceRefs?: Record<string, unknown>
  metadata?: Record<string, unknown>
}
