import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeSourceBlueprintEvidenceRead } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import { listDraftSuggestions } from '@/lib/source-blueprint-drafting/list-draft-suggestions'
import type {
  DraftSuggestionStatus,
  DraftSuggestionType,
} from '@/lib/source-blueprint-drafting/draft-suggestion-types'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')
  const suggestionStatus = req.nextUrl.searchParams.get('suggestion_status')
  const suggestionType = req.nextUrl.searchParams.get('suggestion_type')
  const evidenceId = req.nextUrl.searchParams.get('evidence_id')

  if (!organizationId || !studyId) {
    return NextResponse.json(
      { error: 'organization_id and study_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeSourceBlueprintEvidenceRead(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const suggestions = await listDraftSuggestions(supabase, {
      organizationId,
      studyId,
      suggestionStatus: (suggestionStatus as DraftSuggestionStatus | null) || null,
      suggestionType: (suggestionType as DraftSuggestionType | null) || null,
      evidenceId,
    })
    return NextResponse.json({ ok: true, suggestions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list draft suggestions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
