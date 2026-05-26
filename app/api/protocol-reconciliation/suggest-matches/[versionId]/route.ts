import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolReconciliationWrite } from '@/lib/protocol-reconciliation/protocol-reconciliation-auth'
import { runSuggestProcedureMatches } from '@/lib/protocol-reconciliation/suggest-procedure-matches'

type RouteContext = { params: Promise<{ versionId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { versionId } = await context.params
  let body: { organization_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const organizationId = body.organization_id
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeProtocolReconciliationWrite(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const result = await runSuggestProcedureMatches({
      supabase,
      organizationId,
      protocolVersionId: versionId,
      actorId: auth.userId,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to suggest procedure matches'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
