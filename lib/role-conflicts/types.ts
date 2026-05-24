/**
 * Phase 16A-2.6 — Role conflict types.
 */

import type { WorkflowKey } from '@/lib/governance/workflow-authority/constants'
import type {
  RoleConflictResolution,
  RoleConflictType,
} from '@/lib/role-conflicts/constants'

export type RoleConflictPolicyRow = {
  id: string
  organizationId: string | null
  workflowKey: WorkflowKey
  conflictType: RoleConflictType
  resolution: RoleConflictResolution
  justificationRequired: boolean
  regulated: boolean
  active: boolean
}

export type RoleConflictCheckInput = {
  supabase?: import('@supabase/supabase-js').SupabaseClient
  organizationId: string
  workflowKey: WorkflowKey
  conflictType: RoleConflictType
  /** When true, actor is performing action on own prior work. */
  selfConflict: boolean
}

export type RoleConflictCheckResult = {
  conflictDetected: boolean
  policy: RoleConflictPolicyRow | null
  resolution: RoleConflictResolution | null
  justificationRequired: boolean
  blocked: boolean
  escalated: boolean
}

export type RecordRoleConflictEventInput = {
  supabase: import('@supabase/supabase-js').SupabaseClient
  organizationId: string
  studyId?: string | null
  actorUserId: string
  workflowKey: WorkflowKey
  actionAttempted: string
  conflictingRole?: string | null
  conflictType: RoleConflictType
  resolution: RoleConflictResolution
  justification?: string | null
  metadata?: Record<string, unknown>
}
