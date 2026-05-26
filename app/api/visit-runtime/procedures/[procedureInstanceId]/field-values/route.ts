import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { saveProcedureFieldValues } from '@/lib/visit-runtime-execution/save-procedure-field-values'
import { authorizeVisitRuntimeWrite } from '@/lib/visit-runtime-execution/visit-runtime-auth'

type RouteContext = { params: Promise<{ procedureInstanceId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { procedureInstanceId } = await context.params
  let body: { organization_id?: string; field_values?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }
  if (!body.field_values || typeof body.field_values !== 'object') {
    return NextResponse.json({ error: 'field_values object is required' }, { status: 400 })
  }

  const auth = await authorizeVisitRuntimeWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const procedureInstance = await saveProcedureFieldValues({
      supabase,
      organizationId: body.organization_id,
      procedureInstanceId,
      fieldValues: body.field_values,
      actorId: auth.userId,
    })
    return NextResponse.json({ ok: true, procedureInstance })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save field values'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
