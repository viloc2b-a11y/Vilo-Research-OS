import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolRuntimeGenerationWrite } from '@/lib/protocol-runtime-generation/protocol-runtime-generation-auth'
import { generateStudyRuntimeFromReconciliation } from '@/lib/protocol-runtime-generation/generate-study-runtime-from-reconciliation'

type RouteContext = { params: Promise<{ versionId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { versionId } = await context.params
  let body: { organization_id?: string; study_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id) {
    return NextResponse.json({ error: 'organization_id and study_id are required' }, { status: 400 })
  }

  const auth = await authorizeProtocolRuntimeGenerationWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const result = await generateStudyRuntimeFromReconciliation({
      supabase,
      organizationId: body.organization_id,
      protocolVersionId: versionId,
      studyId: body.study_id,
      actorId: auth.userId,
    })
    return NextResponse.json({
      ok: true,
      generation_run_id: result.generationRunId,
      runtime_snapshot_id: result.runtimeSnapshotId,
      summary: result.summary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate study runtime'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

