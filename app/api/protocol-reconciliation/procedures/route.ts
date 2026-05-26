import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createManualProcedureReconciliation } from '@/lib/protocol-reconciliation/create-manual-procedure-reconciliation'
import { authorizeProtocolReconciliationWrite } from '@/lib/protocol-reconciliation/protocol-reconciliation-auth'
import type { CreateManualProcedureInput } from '@/lib/protocol-reconciliation/protocol-reconciliation-types'

export async function POST(req: NextRequest) {
  let body: CreateManualProcedureInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.protocol_version_id || !body.procedure_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const auth = await authorizeProtocolReconciliationWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const procedure = await createManualProcedureReconciliation({
      supabase,
      input: body,
      createdBy: auth.userId,
    })
    return NextResponse.json({ ok: true, procedure })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create procedure reconciliation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
