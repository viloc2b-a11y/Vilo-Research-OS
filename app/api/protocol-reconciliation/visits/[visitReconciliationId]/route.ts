import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolReconciliationWrite } from '@/lib/protocol-reconciliation/protocol-reconciliation-auth'
import type { UpdateVisitReconciliationInput } from '@/lib/protocol-reconciliation/protocol-reconciliation-types'
import { updateVisitReconciliation } from '@/lib/protocol-reconciliation/update-visit-reconciliation'

type RouteContext = { params: Promise<{ visitReconciliationId: string }> }

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { visitReconciliationId } = await context.params
  let body: UpdateVisitReconciliationInput
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
    const visit = await updateVisitReconciliation({
      supabase,
      visitReconciliationId,
      input: body,
      actorId: auth.userId,
    })
    return NextResponse.json({ ok: true, visit })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update visit reconciliation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
