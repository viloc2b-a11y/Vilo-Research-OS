/**
 * Phase 16A-2.6 — Role conflict detection (policy lookup + audit events).
 */

export {
  ROLE_CONFLICT_TYPE,
  ROLE_CONFLICT_TYPES,
  ROLE_CONFLICT_RESOLUTION,
  ROLE_CONFLICT_RESOLUTIONS,
  GLOBAL_ROLE_CONFLICT_POLICIES,
  findGlobalRoleConflictPolicy,
  roleConflictRequiresJustification,
} from '@/lib/role-conflicts/constants'

export type {
  RoleConflictType,
  RoleConflictResolution,
  GlobalRoleConflictPolicySeed,
} from '@/lib/role-conflicts/constants'

export type {
  RoleConflictCheckInput,
  RoleConflictCheckResult,
  RoleConflictPolicyRow,
  RecordRoleConflictEventInput,
} from '@/lib/role-conflicts/types'

export { checkRoleConflict } from '@/lib/role-conflicts/check-role-conflict'
export {
  recordRoleConflictEvent,
} from '@/lib/role-conflicts/record-role-conflict-event'

export type { RecordRoleConflictEventResult } from '@/lib/role-conflicts/record-role-conflict-event'
