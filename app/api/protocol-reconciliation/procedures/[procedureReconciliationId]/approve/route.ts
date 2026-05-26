import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  approveProcedureReconciliation,
  ProcedureMappingNotReadyError,
} from '@/lib/protocol-reconciliation/approve-procedure-reconciliation'
import { authorizeProtocolReconciliationWrite } from '@/lib/protocol-reconciliation/protocol-reconciliation-auth'

type RouteContext = { params: Promise<{ procedureReconciliationId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { procedureReconciliationId } = await context.params
  let body: { organization_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeProtocolReconciliationWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const procedure = await approveProcedureReconciliation({
      supabase,
      organizationId: body.organization_id,
      procedureReconciliationId,
      actorId: auth.userId,
    })
    return NextResponse.json({ ok: true, procedure })
  } catch (error) {
    if (error instanceof ProcedureMappingNotReadyError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Failed to approve procedure reconciliation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
