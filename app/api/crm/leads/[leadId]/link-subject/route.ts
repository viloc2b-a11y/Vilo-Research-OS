import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canManagePatientCRM } from '@/lib/rbac/permissions'
import { linkLeadToSubject } from '@/lib/crm/link-lead-to-subject'

type RouteContext = { params: Promise<{ leadId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { leadId } = await context.params

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { organization_id?: string; study_subject_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { organization_id: organizationId, study_subject_id: studySubjectId } = body

  if (!organizationId || !studySubjectId) {
    return NextResponse.json(
      { error: 'organization_id and study_subject_id are required' },
      { status: 400 },
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!canManagePatientCRM(memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createServerClient()
  const result = await linkLeadToSubject({
    supabase,
    organizationId,
    leadId,
    studySubjectId,
    actorId: user.id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ ok: true })
}
