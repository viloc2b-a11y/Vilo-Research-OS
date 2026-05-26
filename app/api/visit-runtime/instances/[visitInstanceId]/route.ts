import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { loadVisitWorkspace } from '@/lib/visit-runtime-execution/load-visit-workspace'
import { authorizeVisitRuntimeRead } from '@/lib/visit-runtime-execution/visit-runtime-auth'

type RouteContext = { params: Promise<{ visitInstanceId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { visitInstanceId } = await context.params
  const organizationId = req.nextUrl.searchParams.get('organization_id')

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeVisitRuntimeRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const workspace = await loadVisitWorkspace(supabase, organizationId, visitInstanceId)
    if (!workspace) {
      return NextResponse.json({ error: 'Visit instance not found' }, { status: 404 })
    }
    return NextResponse.json({
      ok: true,
      visitInstance: workspace.visitInstance,
      procedureInstances: workspace.procedureInstances,
      events: workspace.events,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load visit workspace'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
