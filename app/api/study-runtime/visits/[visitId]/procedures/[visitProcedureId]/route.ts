import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { removeProcedureFromVisit } from '@/lib/study-runtime-composition/remove-procedure-from-visit'
import { authorizeStudyRuntimeWrite } from '@/lib/study-runtime-composition/study-runtime-auth'

type RouteContext = { params: Promise<{ visitId: string; visitProcedureId: string }> }

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { visitId, visitProcedureId } = await context.params
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')

  if (!organizationId || !studyId) {
    return NextResponse.json({ error: 'organization_id and study_id are required' }, { status: 400 })
  }

  const auth = await authorizeStudyRuntimeWrite(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    await removeProcedureFromVisit({
      supabase,
      organizationId,
      studyId,
      visitId,
      visitProcedureId,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove procedure from visit'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
