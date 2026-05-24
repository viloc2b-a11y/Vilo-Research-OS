/**
 * Phase 16A-2.5 — Break-glass access types.
 */

import type { BreakGlassApprovalMode, BreakGlassStatus } from '@/lib/break-glass/constants'
import type {
  EffectiveAuthorityLevel,
  WorkflowAuthorityLevel,
  WorkflowKey,
} from '@/lib/governance/workflow-authority/constants'

export type BreakGlassAccessRequestInput = {
  supabase: unknown
  organizationId: string
  actorUserId: string
  studyId?: string | null
  studySubjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  workflowKey: WorkflowKey
  baseAuthorityLevel?: WorkflowAuthorityLevel | null
  effectiveAuthorityLevel?: EffectiveAuthorityLevel | null
  accessScope: string
  resourceType: string
  resourceId?: string | null
  justification: string
  approvalMode: BreakGlassApprovalMode
  expiresAt: string | Date
  notifiedUserIds?: string[]
  postReviewRequired?: boolean
}

export type BreakGlassAccessEventRecord = {
  id: string
  organizationId: string
  actorUserId: string
  studyId: string | null
  studySubjectId: string | null
  visitId: string | null
  procedureExecutionId: string | null
  workflowKey: WorkflowKey
  baseAuthorityLevel: WorkflowAuthorityLevel | null
  effectiveAuthorityLevel: EffectiveAuthorityLevel | null
  accessScope: string
  resourceType: string
  resourceId: string | null
  justification: string
  approvalMode: BreakGlassApprovalMode
  approvedBy: string | null
  notifiedUserIds: string[]
  status: BreakGlassStatus
  expiresAt: string
  closedAt: string | null
  postReviewRequired: boolean
  postReviewCompletedAt: string | null
  reviewNotes: string | null
  operationalEventId: string | null
  createdAt: string
}

export type BreakGlassAccessRequestResult =
  | { ok: true; eventId: string; operationalEventId: string | null }
  | { ok: false; errors: string[] }
