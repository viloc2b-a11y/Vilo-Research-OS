import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeDocumentIntelligenceWrite } from '@/lib/document-intelligence/document-intelligence-auth'
import { releasePhiQuarantineAndContinueIngest } from '@/lib/document-intelligence/release-phi-quarantine'

type RouteContext = { params: Promise<{ intelligenceDocumentId: string }> }

/** Coordinator PHI override — audit logged; does not mutate runtime or published source. */

export async function POST(req: NextRequest, context: RouteContext) {
  const { intelligenceDocumentId } = await context.params
  let body: {
    organization_id?: string
    study_id?: string
    ingestion_run_id?: string
    override_notes?: string
    domains?: string[] | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.override_notes?.trim()) {
    return NextResponse.json(
      { error: 'organization_id, study_id, and override_notes are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeDocumentIntelligenceWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const result = await releasePhiQuarantineAndContinueIngest({
      supabase,
      organizationId: body.organization_id,
      studyId: body.study_id,
      intelligenceDocumentId,
      ingestionRunId: body.ingestion_run_id ?? '',
      actorId: auth.userId,
      overrideNotes: body.override_notes,
      explicitDomains: body.domains,
    })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Release failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
