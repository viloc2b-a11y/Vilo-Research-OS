import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolReconciliationWrite } from '@/lib/protocol-reconciliation/protocol-reconciliation-auth'
import type { UpdateProcedureMappingInput } from '@/lib/protocol-reconciliation/protocol-reconciliation-types'
import { updateProcedureMapping } from '@/lib/protocol-reconciliation/update-procedure-mapping'

type RouteContext = { params: Promise<{ procedureReconciliationId: string }> }

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { procedureReconciliationId } = await context.params
  let body: UpdateProcedureMappingInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.matched_procedure_library_id) {
    return NextResponse.json({ error: 'organization_id and matched_procedure_library_id are required' }, { status: 400 })
  }

  const auth = await authorizeProtocolReconciliationWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const procedure = await updateProcedureMapping({
      supabase,
      procedureReconciliationId,
      input: body,
      actorId: auth.userId,
    })
    return NextResponse.json({ ok: true, procedure })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update procedure mapping'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
