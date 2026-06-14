import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { computeComplianceSummary } from '@/lib/compliance-intelligence/compute-compliance-summary'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organization_id')
  const studyId = searchParams.get('study_id') ?? undefined

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

  const supabase = await createServerClient()

  try {
    const summary = await computeComplianceSummary({
      supabase,
      organizationId,
      studyId,
    })

    return NextResponse.json({ summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
