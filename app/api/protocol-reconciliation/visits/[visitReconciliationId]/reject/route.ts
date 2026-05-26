import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolReconciliationWrite } from '@/lib/protocol-reconciliation/protocol-reconciliation-auth'
import { rejectVisitReconciliation } from '@/lib/protocol-reconciliation/reject-visit-reconciliation'

type RouteContext = { params: Promise<{ visitReconciliationId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { visitReconciliationId } = await context.params
  let body: { organization_id?: string; reason?: string }
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
    const visit = await rejectVisitReconciliation({
      supabase,
      organizationId: body.organization_id,
      visitReconciliationId,
      actorId: auth.userId,
      reason: body.reason,
    })
    return NextResponse.json({ ok: true, visit })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reject visit reconciliation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
