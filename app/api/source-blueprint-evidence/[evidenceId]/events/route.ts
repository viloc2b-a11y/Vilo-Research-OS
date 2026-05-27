import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeSourceBlueprintEvidenceRead } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import { loadEvidenceReviewEvents } from '@/lib/source-blueprint-evidence/load-evidence-review-events'

type RouteContext = { params: Promise<{ evidenceId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { evidenceId } = await context.params
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')

  if (!organizationId || !studyId) {
    return NextResponse.json(
      { error: 'organization_id and study_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeSourceBlueprintEvidenceRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const events = await loadEvidenceReviewEvents(
      supabase,
      organizationId,
      studyId,
      evidenceId,
    )
    return NextResponse.json({ ok: true, events })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load events'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
