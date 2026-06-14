import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { computeRegulatorySnapshot } from '@/lib/regulatory-intelligence/compute-regulatory-snapshot'

type RouteParams = { params: Promise<{ studyId: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organization_id')

  if (!organizationId) {
    return NextResponse.json(
      { error: 'organization_id is required' },
      { status: 400 },
    )
  }

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  const { studyId } = await params
  const supabase = await createServerClient()

  try {
    const snapshot = await computeRegulatorySnapshot({
      supabase,
      organizationId,
      studyId,
    })

    return NextResponse.json({ snapshot })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
