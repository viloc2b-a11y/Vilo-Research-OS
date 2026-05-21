/**
 * Phase 5.1A — Session + organization scope for Source API routes.
 */

import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships } from '@/lib/auth/session'
import { apiError } from '@/lib/api/source/errors'
import { errorEnvelope } from '@/lib/api/source/envelope'
import { jsonEnvelope } from '@/lib/api/source/respond'
import { createServerClient } from '@/lib/supabase/server'

export type SourceApiContext = {
  supabase: SupabaseClient
  user: User
  requestId: string
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export async function requireSourceApiContext(): Promise<
  { ok: true; ctx: SourceApiContext } | { ok: false; response: ReturnType<typeof jsonEnvelope> }
> {
  const requestId = newRequestId()
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.id) {
    return {
      ok: false,
      response: jsonEnvelope(
        errorEnvelope(
          'UNAUTHORIZED',
          [apiError('UNAUTHORIZED', 'Authentication required', null, null, 'api')],
          { requestId },
        ),
        401,
      ),
    }
  }

  return { ok: true, ctx: { supabase, user, requestId } }
}

export async function requireOrganizationMember(
  ctx: SourceApiContext,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; response: ReturnType<typeof jsonEnvelope> }> {
  const memberships = await getOrganizationMemberships(ctx.user.id)
  const allowed = hasActiveOrganizationMembership(memberships, organizationId)
  if (!allowed) {
    return {
      ok: false,
      response: jsonEnvelope(
        errorEnvelope(
          'FORBIDDEN',
          [
            apiError(
              'FORBIDDEN',
              'User is not a member of the requested organization',
              { organization_id: organizationId },
              null,
              'api',
            ),
          ],
          { requestId: ctx.requestId },
        ),
        403,
      ),
    }
  }
  return { ok: true }
}
