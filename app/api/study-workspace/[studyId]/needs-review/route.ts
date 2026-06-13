import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import {
  loadNeedsReviewQueue,
  type NeedsReviewFilters,
} from '@/lib/longitudinal-labs/load-needs-review-queue'

type RouteContext = { params: Promise<{ studyId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
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

  const { searchParams } = new URL(request.url)
  const filters: NeedsReviewFilters = {}

  const priority = searchParams.get('priority')
  if (priority) filters.priority = priority

  const type = searchParams.get('type')
  if (type) filters.type = type

  const status = searchParams.get('status')
  if (status) filters.status = status

  const subjectId = searchParams.get('subjectId')
  if (subjectId) filters.subjectId = subjectId

  try {
    const result = await loadNeedsReviewQueue(supabase, studyId, organizationId, filters)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load needs review queue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
