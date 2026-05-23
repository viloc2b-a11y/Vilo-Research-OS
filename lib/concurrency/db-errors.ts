import { STALE_WRITE_USER_MESSAGE } from '@/lib/concurrency/stale-write'

/**
 * H5 Phase 3: Coordinator-Safe DB Error Translation
 * Prevents raw Postgres exceptions (like terminal guards, delete blocks, operational limits)
 * from crashing the UI as 500 errors, returning safe coordinator-facing messages instead.
 */
export function mapRuntimeDbErrorToCoordinatorMessage(error: unknown, fallbackMessage = 'Action failed.'): string {
  if (!error) return fallbackMessage

  const message = typeof error === 'string' ? error : (error as Error).message
  if (!message) return fallbackMessage

  const msgLower = message.toLowerCase()

  // 2. Terminal Visit State (H4 Phase 2 Guard)
  // "visit_status locked is terminal and cannot be changed"
  if (msgLower.includes('is terminal and cannot be changed')) {
    const match = message.match(/visit_status (\w+) is terminal/i)
    const status = match ? match[1] : 'terminal'
    return `Cannot modify: the visit is in a locked or terminal (${status}) state.`
  }

  // 1. Stale Write / Optimistic Concurrency
  if (/refresh|stale_write|set_not_mutable|submitted_value_immutable/i.test(message) || (msgLower.includes('changed') && !msgLower.includes('terminal'))) {
    return STALE_WRITE_USER_MESSAGE
  }


  // 3. Delete Blocked (H4 Phase 4 Guards)
  if (msgLower.includes('cannot delete') || msgLower.includes('violates foreign key constraint') || msgLower.includes('delete_guard')) {
    if (msgLower.includes('visit') || msgLower.includes('visits')) {
      return 'Cannot delete: active visits exist and must be cancelled instead.'
    }
    if (msgLower.includes('procedure_execution')) {
      return 'Cannot delete: this procedure is no longer pending.'
    }
    if (msgLower.includes('source_response')) {
      return 'Cannot delete: source responses have been submitted. Use data corrections instead.'
    }
    if (msgLower.includes('visit_progress_notes')) {
      return 'Cannot delete: progress notes have been signed.'
    }
    return 'This record cannot be physically deleted due to runtime clinical constraints.'
  }

  // 4. Immutable Operational Event (H4 Phase 2 Guard)
  if (msgLower.includes('operational events are strictly append-only')) {
    return 'Audit events are immutable and cannot be modified.'
  }

  // 5. Source Locked / Submitted
  if (msgLower.includes('source locked') || msgLower.includes('submitted')) {
    return 'Cannot edit: this source material is already submitted or locked.'
  }

  // 6. Unauthorized / Blinded Access
  if (msgLower.includes('unblinded') || msgLower.includes('permission') || msgLower.includes('role') || msgLower.includes('insufficient')) {
    return 'You do not have the required permissions or unblinded access to perform this action.'
  }

  // Preserve generic errors without leaking SQL
  return fallbackMessage
}
