import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { computeInspectionReadinessScore } from '@/lib/inspection-readiness/compute-readiness-score'

type RouteContext = { params: Promise<{ studyId: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  const { studyId } = await context.params

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServerClient()

  const { data: study } = await supabase
    .from('studies')
    .select('organization_id')
    .eq('id', studyId)
    .maybeSingle()

  if (!study) {
    return NextResponse.json({ error: 'Study not found' }, { status: 404 })
  }

  const organizationId = String(study.organization_id)
  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const score = await computeInspectionReadinessScore({
      supabase,
      organizationId,
      studyId,
    })
    return NextResponse.json({ score })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to compute inspection readiness score'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
