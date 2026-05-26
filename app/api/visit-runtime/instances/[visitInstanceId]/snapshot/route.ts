import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { loadVisitSnapshotByVisitInstance } from '@/lib/visit-runtime-locking/load-visit-snapshot'
import { authorizeVisitRuntimeRead } from '@/lib/visit-runtime-locking/visit-locking-auth'

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
    const snapshot = await loadVisitSnapshotByVisitInstance(
      supabase,
      organizationId,
      visitInstanceId,
    )
    if (!snapshot) {
      return NextResponse.json({ error: 'Visit snapshot not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, snapshot })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load visit snapshot'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
