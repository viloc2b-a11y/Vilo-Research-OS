import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeSourceBlueprintEvidenceWrite } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import { acceptSourceBlueprintEvidence } from '@/lib/source-blueprint-evidence/accept-source-blueprint-evidence'
import { EvidenceReviewStateError } from '@/lib/source-blueprint-evidence/accept-source-blueprint-evidence'

type RouteContext = { params: Promise<{ evidenceId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { evidenceId } = await context.params
  let body: { organization_id?: string; study_id?: string; review_notes?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id) {
    return NextResponse.json(
      { error: 'organization_id and study_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeSourceBlueprintEvidenceWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const evidence = await acceptSourceBlueprintEvidence({
      supabase,
      organizationId: body.organization_id,
      studyId: body.study_id,
      evidenceId,
      actorId: auth.userId,
      reviewNotes: body.review_notes,
    })
    return NextResponse.json({ ok: true, evidence })
  } catch (error) {
    if (error instanceof EvidenceReviewStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Accept failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
