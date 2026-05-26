import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { compileStudyRuntimeGraph } from '@/lib/study-runtime-composition/compile-study-runtime-graph'
import { createCompositionSnapshot } from '@/lib/study-runtime-composition/create-composition-snapshot'
import { authorizeStudyRuntimeWrite } from '@/lib/study-runtime-composition/study-runtime-auth'

export async function POST(req: NextRequest) {
  let body: { organization_id?: string; study_id?: string; persist_snapshot?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const organizationId = body.organization_id
  const studyId = body.study_id
  if (!organizationId || !studyId) {
    return NextResponse.json({ error: 'organization_id and study_id are required' }, { status: 400 })
  }

  const auth = await authorizeStudyRuntimeWrite(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const compiled = await compileStudyRuntimeGraph({
      supabase,
      organizationId,
      studyId,
    })

    const persistSnapshot = body.persist_snapshot !== false
    const snapshot = persistSnapshot
      ? await createCompositionSnapshot({
          supabase,
          organizationId,
          studyId,
          createdBy: auth.userId,
          graph: compiled.graph,
          graphHash: compiled.graphHash,
        })
      : null

    return NextResponse.json({
      ok: true,
      graph: compiled.graph,
      graphHash: compiled.graphHash,
      snapshot,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to compile study runtime graph'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
