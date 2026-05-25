'use server'

import { getSessionUser } from '@/lib/auth/session'
import { publishProtocolGraph } from '@/lib/protocol-graph/publish'
import type { PublishProtocolGraphFormState } from '@/lib/protocol-graph/publish-action-state'
import { createServerClient } from '@/lib/supabase/server'

export async function publishProtocolGraphAction(input: {
  organizationId: string
  studyId: string
  studyVersionId?: string | null
}): Promise<PublishProtocolGraphFormState> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Sign in required.' }

  const supabase = await createServerClient()
  const result = await publishProtocolGraph({
    supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studyVersionId: input.studyVersionId,
    actorUserId: user.id,
  })

  if (!result.ok) return { ok: false, message: result.error }

  return {
    ok: true,
    message: `Protocol graph revision ${result.graphRevision} published.`,
    publicationId: result.publicationId,
    graphRevision: result.graphRevision,
  }
}
