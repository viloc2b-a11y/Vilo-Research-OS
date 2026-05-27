import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { loadSnapshotReviewWorkspace } from '@/lib/operational-review/load-snapshot-review-workspace'
import { authorizeOperationalReviewRead } from '@/lib/operational-review/operational-review-auth'

type RouteContext = { params: Promise<{ snapshotId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { snapshotId } = await context.params
  const organizationId = req.nextUrl.searchParams.get('organization_id')

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeOperationalReviewRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const workspace = await loadSnapshotReviewWorkspace(supabase, organizationId, snapshotId)
    if (!workspace) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...workspace })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load review workspace'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
