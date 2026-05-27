import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeSourceBlueprintEvidenceRead } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import { listSourceBlueprintSignoffs } from '@/lib/source-blueprint-signoff/list-signoffs'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')

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
    const signoffs = await listSourceBlueprintSignoffs(supabase, organizationId, studyId)
    return NextResponse.json({ ok: true, signoffs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list sign-offs'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
