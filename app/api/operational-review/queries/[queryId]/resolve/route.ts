import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveSnapshotQuery } from '@/lib/operational-review/resolve-snapshot-query'
import { authorizeOperationalReviewWrite } from '@/lib/operational-review/operational-review-auth'

type RouteContext = { params: Promise<{ queryId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { queryId } = await context.params
  let body: { organization_id?: string; resolution_text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.resolution_text) {
    return NextResponse.json(
      { error: 'organization_id and resolution_text are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeOperationalReviewWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const query = await resolveSnapshotQuery({
      supabase,
      organizationId: body.organization_id,
      queryId,
      actorId: auth.userId,
      resolutionText: body.resolution_text,
    })
    return NextResponse.json({ ok: true, query })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve query'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
