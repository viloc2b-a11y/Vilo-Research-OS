import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { activateAmendmentActions, type ActivationResult } from '@/lib/amendment-runtime/activate-amendment-actions'

type RouteContext = { params: Promise<{ studyId: string; versionId: string }> }

type RequestBody = {
  organization_id: string
  requires_reconsent: boolean
  requires_training_review: boolean
  impact_reason?: string
}

export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { studyId, versionId } = await context.params

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { organization_id, requires_reconsent, requires_training_review, impact_reason } = body

  if (!organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await requireActiveOrganizationAccess(organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  const supabase = await createServerClient()

  try {
    const result: ActivationResult = await activateAmendmentActions({
      supabase,
      organizationId: organization_id,
      studyId,
      protocolVersionId: versionId,
      requiresReconsent: requires_reconsent ?? false,
      requiresTrainingReview: requires_training_review ?? false,
      actorId: auth.user.id,
      impactReason: impact_reason,
    })

    return NextResponse.json({ result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to activate amendment actions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
