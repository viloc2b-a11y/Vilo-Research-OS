'use server'

import { getSessionUser } from '@/lib/auth/session'
import { logAuditEvent } from '@/lib/audit/log'

export async function logPasswordResetAction(status: 'completed' | 'failed', details?: string) {
  const user = await getSessionUser()
  if (!user) return // Cannot log if we don't know who they are

  await logAuditEvent({
    organizationId: null, // Password reset is global/tenant-agnostic
    actorUserId: user.id,
    action: `password_reset.${status}`,
    target: `user:${user.id}`,
    metadata: { details }
  })
}
