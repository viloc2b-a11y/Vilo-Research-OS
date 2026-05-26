import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, getOrganizationMemberships } from '@/lib/auth/session'
import { canAccessOrganization } from '@/lib/auth/membership-access'
import { listRecentComplianceDocuments } from '@/lib/document-intake/list-recent-documents'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organizationId = req.nextUrl.searchParams.get('organization_id')
  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organization_id' }, { status: 400 })
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createServerClient()
  const documents = await listRecentComplianceDocuments(supabase, organizationId)

  return NextResponse.json({ ok: true, documents })
}
