import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createSnapshotReview } from '@/lib/operational-review/create-snapshot-review'
import { authorizeOperationalReviewWrite } from '@/lib/operational-review/operational-review-auth'
import type { CreateSnapshotReviewInput } from '@/lib/operational-review/operational-review-types'

export async function POST(req: NextRequest) {
  let body: CreateSnapshotReviewInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.subject_id || !body.snapshot_id) {
    return NextResponse.json(
      { error: 'organization_id, study_id, subject_id, and snapshot_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeOperationalReviewWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const review = await createSnapshotReview({
      supabase,
      input: body,
      createdBy: auth.userId,
    })
    return NextResponse.json({ ok: true, review })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create review'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
