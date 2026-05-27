import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeSourceBlueprintEvidenceWrite } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import {
  createSourceBlueprintSignoff,
  SourceBlueprintSignoffStateError,
} from '@/lib/source-blueprint-signoff/create-signoff'

export async function POST(req: NextRequest) {
  let body: {
    organization_id?: string
    study_id?: string
    suggestion_ids?: string[]
    signoff_statement?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.suggestion_ids || !body.signoff_statement) {
    return NextResponse.json(
      { error: 'organization_id, study_id, suggestion_ids, and signoff_statement are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeSourceBlueprintEvidenceWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const signoff = await createSourceBlueprintSignoff(supabase, {
      organizationId: body.organization_id,
      studyId: body.study_id,
      suggestionIds: body.suggestion_ids,
      signoffStatement: body.signoff_statement,
      signedBy: auth.userId,
    })
    return NextResponse.json({ ok: true, signoff })
  } catch (error) {
    if (error instanceof SourceBlueprintSignoffStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Failed to create sign-off'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
