import { NextResponse } from 'next/server'
import { activeMemberships } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

export async function POST() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  if (memberships.length === 0) {
    return NextResponse.json({ error: 'No organization access.' }, { status: 403 })
  }

  const organizationId = memberships[0].organization_id
  const supabase = await createServerClient()

  const { data, error } = await supabase.rpc('escalate_overdue_sla_actions', {
    p_organization_id: organizationId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ escalated: data as number })
}
