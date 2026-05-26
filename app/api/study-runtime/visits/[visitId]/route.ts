import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateRuntimeVisit } from '@/lib/study-runtime-composition/update-runtime-visit'
import { authorizeStudyRuntimeWrite } from '@/lib/study-runtime-composition/study-runtime-auth'
import type { UpdateRuntimeVisitInput } from '@/lib/study-runtime-composition/runtime-composition-types'

type RouteContext = { params: Promise<{ visitId: string }> }

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { visitId } = await context.params

  let body: UpdateRuntimeVisitInput & { organization_id?: string; study_id?: string }
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
    const visit = await updateRuntimeVisit({
      supabase,
      organizationId,
      studyId,
      visitId,
      input: body,
    })
    return NextResponse.json({ ok: true, visit })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update runtime visit'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
