import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { canManageProtocolDeviations } from '@/lib/rbac/permissions'
import { createCapaAction } from '@/lib/capa-runtime/create-capa-action'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const organizationId = body.organization_id as string | undefined
  const studyId = body.study_id as string | undefined
  const deviationId = body.deviation_id as string | undefined

  if (!organizationId || !studyId || !deviationId) {
    return NextResponse.json(
      { error: 'organization_id, study_id, and deviation_id are required' },
      { status: 400 },
    )
  }

  if (!body.corrective_action) {
    return NextResponse.json(
      { error: 'corrective_action is required' },
      { status: 400 },
    )
  }

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  if (!canManageProtocolDeviations(auth.memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createServerClient()

  try {
    const action = await createCapaAction(supabase, auth.user.id, {
      organizationId,
      studyId,
      deviationId,
      correctiveAction: body.corrective_action as string,
      preventiveAction: (body.preventive_action as string) ?? null,
      rootCauseAnalysis: (body.root_cause_analysis as string) ?? null,
      ownerId: (body.owner_id as string) ?? null,
      dueDate: (body.due_date as string) ?? null,
      effectivenessCheckRequired: body.effectiveness_check_required as boolean | undefined,
      metadata: (body.metadata as Record<string, unknown>) ?? {},
    })

    return NextResponse.json({ ok: true, action })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
