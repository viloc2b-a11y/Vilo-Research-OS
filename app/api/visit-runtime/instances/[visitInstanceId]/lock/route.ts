import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { lockVisitRuntimeInstance } from '@/lib/visit-runtime-locking/lock-visit-runtime-instance'
import { authorizeVisitRuntimeWrite } from '@/lib/visit-runtime-locking/visit-locking-auth'

type RouteContext = { params: Promise<{ visitInstanceId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { visitInstanceId } = await context.params
  let body: { organization_id?: string; lock_reason?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeVisitRuntimeWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const result = await lockVisitRuntimeInstance({
      supabase,
      organizationId: body.organization_id,
      visitInstanceId,
      lockedBy: auth.userId,
      lockReason: body.lock_reason,
    })
    return NextResponse.json({
      ok: true,
      snapshot_id: result.snapshot.id,
      snapshot_hash: result.snapshotHash,
      snapshot: result.snapshot,
      idempotent: result.idempotent,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to lock visit'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
