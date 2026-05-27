import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeSourceBlueprintEvidenceRead } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import { loadSourceBlueprintEvidenceById } from '@/lib/source-blueprint-evidence/list-source-blueprint-evidence'
import { loadEvidenceLineage } from '@/lib/source-blueprint-evidence/load-evidence-lineage'
import { inferDefaultTraceOrigin } from '@/lib/source-blueprint-evidence/infer-default-trace-origin'

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
    const evidence = await loadSourceBlueprintEvidenceById(
      supabase,
      organizationId,
      studyId,
      evidenceId,
    )
    if (!evidence) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
    }
    const lineage = await loadEvidenceLineage(supabase, organizationId, studyId, evidenceId)
    const suggestedTraceOrigin = inferDefaultTraceOrigin(
      evidence.usageDomain,
      evidence.evidenceKind,
    )
    return NextResponse.json({ ok: true, evidence, lineage, suggestedTraceOrigin })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load evidence'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
