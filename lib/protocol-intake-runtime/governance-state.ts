import type { ProtocolStatus } from '@/lib/protocol-intake-runtime/protocol-intake-types'

export type ProtocolGovernanceState = 'review' | 'signoff' | 'lock' | 'supersede'

export type ProtocolGovernanceStateSnapshot = {
  state: ProtocolGovernanceState
  label: string
  detail: string
}

export function deriveProtocolGovernanceState(status: ProtocolStatus): ProtocolGovernanceStateSnapshot {
  switch (status) {
    case 'draft':
    case 'under_review':
      return {
        state: 'review',
        label: 'Review',
        detail: 'Protocol intake is still being interpreted and reconciled.',
      }
    case 'runtime_mapping':
    case 'ready_for_generation':
      return {
        state: 'signoff',
        label: 'Sign-off',
        detail: 'Protocol is reconciled and awaiting runtime generation or final approval.',
      }
    case 'published':
      return {
        state: 'lock',
        label: 'Locked',
        detail: 'Protocol version is published and locked as the active runtime source.',
      }
    case 'archived':
      return {
        state: 'supersede',
        label: 'Superseded',
        detail: 'Protocol version is archived and retained only for lineage.',
      }
    default:
      return {
        state: 'review',
        label: 'Review',
        detail: 'Protocol lifecycle state is not recognized; defaulting to review.',
      }
  }
}
