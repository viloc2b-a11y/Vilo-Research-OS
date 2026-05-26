import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolReconciliationRead } from '@/lib/protocol-reconciliation/protocol-reconciliation-auth'
import { listReconciliationWorkspace } from '@/lib/protocol-reconciliation/list-reconciliation-workspace'

type RouteContext = { params: Promise<{ versionId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { versionId } = await context.params
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeProtocolReconciliationRead(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const workspace = await listReconciliationWorkspace(supabase, organizationId, versionId)
    if (!workspace) return NextResponse.json({ error: 'Protocol version not found' }, { status: 404 })
    return NextResponse.json({ ok: true, workspace })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load reconciliation workspace'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
