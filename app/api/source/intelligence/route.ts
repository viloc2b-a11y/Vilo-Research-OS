import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canAccessOrganization } from '@/lib/auth/membership-access'
import { computeSourceIntelligence } from '@/lib/source/intelligence/compute-source-intelligence'

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const organizationId = url.searchParams.get('organization_id')
  const visitId = url.searchParams.get('visit_id')
  const subjectId = url.searchParams.get('subject_id') ?? undefined

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }
  if (!visitId) {
    return NextResponse.json({ error: 'visit_id is required' }, { status: 400 })
  }

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createServerClient()

  try {
    const report = await computeSourceIntelligence({
      supabase,
      organizationId,
      visitId,
      subjectId,
    })
    return NextResponse.json({ report })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to compute source intelligence'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
