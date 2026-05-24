/**
 * Phase 16A-2.5 — Delegation runtime check foundation.
 */

export {
  DELEGATION_CHECK_RESULT,
  DELEGATION_CHECK_RESULTS,
  DELEGATION_RUNTIME_OUTCOME,
} from '@/lib/delegation-runtime/constants'

export type {
  DelegationCheckResult,
  DelegationRuntimeOutcome,
} from '@/lib/delegation-runtime/constants'

export {
  checkDelegationRuntime,
  resolveProcedureDelegationRequirement,
} from '@/lib/delegation-runtime/check-delegation'

export { recordDelegationRuntimeCheck } from '@/lib/delegation-runtime/record-check'
export type { RecordDelegationRuntimeCheckInput } from '@/lib/delegation-runtime/record-check'

export type {
  DelegationRuntimeCheckInput,
  DelegationRuntimeCheckOutcome,
  DelegationRuntimeCheckRecordInput,
  ProcedureDelegationRequirement,
} from '@/lib/delegation-runtime/types'
