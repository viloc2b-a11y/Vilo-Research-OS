/**
 * Phase 16A-2.5 — Break-glass access foundation.
 */

export {
  BREAK_GLASS_APPROVAL_MODE,
  BREAK_GLASS_APPROVAL_MODES,
  BREAK_GLASS_APPROVAL_MODES_V0,
  BREAK_GLASS_DEFAULT_TTL_HOURS,
  BREAK_GLASS_STATUS,
  BREAK_GLASS_STATUSES,
  isBreakGlassApprovalModeV0Supported,
} from '@/lib/break-glass/constants'

export type {
  BreakGlassApprovalMode,
  BreakGlassStatus,
} from '@/lib/break-glass/constants'

export { requestBreakGlassAccess } from '@/lib/break-glass/request-break-glass-access'

export { validateBreakGlassAccessRequest } from '@/lib/break-glass/validate-request'

export {
  BREAK_GLASS_ACCESS_VALIDATION,
  validateBreakGlassAccess,
  validateBreakGlassAccessAttempt,
} from '@/lib/break-glass/validate-break-glass-access'

export type {
  BreakGlassAccessValidation,
  ValidateBreakGlassAccessAttemptInput,
  ValidateBreakGlassAccessAttemptResult,
  ValidateBreakGlassAccessInput,
} from '@/lib/break-glass/validate-break-glass-access'

export type {
  BreakGlassAccessEventRecord,
  BreakGlassAccessRequestInput,
  BreakGlassAccessRequestResult,
} from '@/lib/break-glass/types'
