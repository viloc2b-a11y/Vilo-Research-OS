import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { computeCoordinatorWorkload } from '@/lib/performance/portfolio/compute-coordinator-workload'

type RouteContext = { params: Promise<{ coordinatorId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { coordinatorId } = await context.params

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organizationId = req.nextUrl.searchParams.get('organizationId')
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId query parameter is required' }, { status: 400 })
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const supabase = await createServerClient()
    const workload = await computeCoordinatorWorkload({ supabase, organizationId, coordinatorId })
    return NextResponse.json({ workload })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to compute coordinator workload'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
