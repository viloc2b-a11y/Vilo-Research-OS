import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeSourceBlueprintEvidenceWrite } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import {
  DraftSuggestionReviewStateError,
  reviewDraftSuggestion,
} from '@/lib/source-blueprint-drafting/review-draft-suggestion'
import { DRAFT_SUGGESTION_STATUS } from '@/lib/source-blueprint-drafting/draft-suggestion-types'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  let body: {
    organization_id?: string
    study_id?: string
    suggestion_status?: string
    review_notes?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.suggestion_status) {
    return NextResponse.json(
      { error: 'organization_id, study_id, and suggestion_status are required' },
      { status: 400 },
    )
  }

  if (
    body.suggestion_status !== DRAFT_SUGGESTION_STATUS.ACCEPTED_FOR_MANUAL_USE &&
    body.suggestion_status !== DRAFT_SUGGESTION_STATUS.REJECTED &&
    body.suggestion_status !== DRAFT_SUGGESTION_STATUS.ARCHIVED
  ) {
    return NextResponse.json({ error: 'Unsupported review status' }, { status: 400 })
  }

  const auth = await authorizeSourceBlueprintEvidenceWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const suggestion = await reviewDraftSuggestion(supabase, {
      organizationId: body.organization_id,
      studyId: body.study_id,
      suggestionId: id,
      reviewerId: auth.userId,
      suggestionStatus: body.suggestion_status,
      reviewNotes: body.review_notes,
    })
    return NextResponse.json({ ok: true, suggestion })
  } catch (error) {
    if (error instanceof DraftSuggestionReviewStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Failed to review draft suggestion'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
