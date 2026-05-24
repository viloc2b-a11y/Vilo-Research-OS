/**
 * Phase 16A-2.5 — Break-glass access constants.
 */

export const BREAK_GLASS_APPROVAL_MODE = {
  SELF_GRANTED: 'self_granted',
  DUAL_CONFIRMED: 'dual_confirmed',
} as const

export const BREAK_GLASS_APPROVAL_MODES = [
  BREAK_GLASS_APPROVAL_MODE.SELF_GRANTED,
  BREAK_GLASS_APPROVAL_MODE.DUAL_CONFIRMED,
] as const

export type BreakGlassApprovalMode = (typeof BREAK_GLASS_APPROVAL_MODES)[number]

/** v0 API allows self_granted only; schema supports dual_confirmed for future. */
export const BREAK_GLASS_APPROVAL_MODES_V0 = [BREAK_GLASS_APPROVAL_MODE.SELF_GRANTED] as const

export const BREAK_GLASS_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVIEWED: 'reviewed',
  REJECTED: 'rejected',
} as const

export const BREAK_GLASS_STATUSES = [
  BREAK_GLASS_STATUS.ACTIVE,
  BREAK_GLASS_STATUS.EXPIRED,
  BREAK_GLASS_STATUS.REVIEWED,
  BREAK_GLASS_STATUS.REJECTED,
] as const

export type BreakGlassStatus = (typeof BREAK_GLASS_STATUSES)[number]

export const BREAK_GLASS_DEFAULT_TTL_HOURS = 4

export function isBreakGlassApprovalModeV0Supported(
  value: string,
): value is (typeof BREAK_GLASS_APPROVAL_MODES_V0)[number] {
  return (BREAK_GLASS_APPROVAL_MODES_V0 as readonly string[]).includes(value)
}
