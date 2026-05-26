import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { addProcedureToVisit } from '@/lib/study-runtime-composition/add-procedure-to-visit'
import { authorizeStudyRuntimeWrite } from '@/lib/study-runtime-composition/study-runtime-auth'
import type { AddProcedureToVisitInput } from '@/lib/study-runtime-composition/runtime-composition-types'

type RouteContext = { params: Promise<{ visitId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { visitId } = await context.params

  let body: AddProcedureToVisitInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  body.visit_id = visitId

  if (
    !body.organization_id
    || !body.study_id
    || !body.study_procedure_blueprint_id
    || body.procedure_order === undefined
  ) {
    return NextResponse.json(
      {
        error:
          'organization_id, study_id, study_procedure_blueprint_id, and procedure_order are required',
      },
      { status: 400 },
    )
  }

  const auth = await authorizeStudyRuntimeWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const procedure = await addProcedureToVisit({
      supabase,
      input: body,
      createdBy: auth.userId,
    })
    return NextResponse.json({ ok: true, procedure })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add procedure to visit'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
