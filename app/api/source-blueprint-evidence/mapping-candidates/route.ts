import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeSourceBlueprintEvidenceRead } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import { loadBlueprintLineageCandidates } from '@/lib/source-blueprint-evidence/load-blueprint-lineage-candidates'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')
  const blueprintVersionId = req.nextUrl.searchParams.get('blueprint_version_id')

  if (!organizationId || !studyId || !blueprintVersionId) {
    return NextResponse.json(
      {
        error:
          'organization_id, study_id, and blueprint_version_id are required (single-study scope)',
      },
      { status: 400 },
    )
  }

  const auth = await authorizeSourceBlueprintEvidenceRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const candidates = await loadBlueprintLineageCandidates(supabase, blueprintVersionId)
    return NextResponse.json({ ok: true, candidates })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load mapping candidates'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
