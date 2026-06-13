import { type NextRequest, NextResponse } from 'next/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { createServerClient } from '@/lib/supabase/server'
import { buildSubjectLabTimeline } from '@/lib/longitudinal-labs/build-subject-lab-timeline'

type GetTimelineParams = {
  params: Promise<{ subjectId: string }>
}

export async function GET(request: NextRequest, { params }: GetTimelineParams) {
  try {
    const { subjectId } = await params
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const studyId = searchParams.get('studyId')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId query parameter is required.' },
        { status: 400 },
      )
    }

    const auth = await requireActiveOrganizationAccess(organizationId)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: 401 })
    }

    const supabase = await createServerClient()
    const data = await buildSubjectLabTimeline(supabase, organizationId, subjectId)

    return NextResponse.json({
      subjectId,
      studyId: studyId ?? null,
      tests: data.structuredTests,
      reviews: data.reviewItems,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
