import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolReconciliationWrite } from '@/lib/protocol-reconciliation/protocol-reconciliation-auth'
import { createManualVisitReconciliation } from '@/lib/protocol-reconciliation/create-manual-visit-reconciliation'
import type { CreateManualVisitInput } from '@/lib/protocol-reconciliation/protocol-reconciliation-types'

export async function POST(req: NextRequest) {
  let body: CreateManualVisitInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.protocol_version_id || !body.visit_code || !body.visit_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const auth = await authorizeProtocolReconciliationWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const visit = await createManualVisitReconciliation({
      supabase,
      input: body,
      createdBy: auth.userId,
    })
    return NextResponse.json({ ok: true, visit })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create visit reconciliation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
