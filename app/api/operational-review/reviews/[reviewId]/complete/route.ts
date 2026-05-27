import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { completeSnapshotReview } from '@/lib/operational-review/complete-snapshot-review'
import { authorizeOperationalReviewWrite } from '@/lib/operational-review/operational-review-auth'

type RouteContext = { params: Promise<{ reviewId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { reviewId } = await context.params
  let body: { organization_id?: string; review_notes?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeOperationalReviewWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const review = await completeSnapshotReview({
      supabase,
      organizationId: body.organization_id,
      reviewId,
      actorId: auth.userId,
      reviewNotes: body.review_notes,
    })
    return NextResponse.json({ ok: true, review })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete review'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
