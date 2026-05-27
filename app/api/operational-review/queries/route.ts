import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { openSnapshotQuery } from '@/lib/operational-review/open-snapshot-query'
import { authorizeOperationalReviewWrite } from '@/lib/operational-review/operational-review-auth'
import type { OpenSnapshotQueryInput } from '@/lib/operational-review/operational-review-types'

export async function POST(req: NextRequest) {
  let body: OpenSnapshotQueryInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    !body.organization_id
    || !body.study_id
    || !body.subject_id
    || !body.snapshot_id
    || !body.query_scope
    || !body.query_text
  ) {
    return NextResponse.json(
      {
        error:
          'organization_id, study_id, subject_id, snapshot_id, query_scope, and query_text are required',
      },
      { status: 400 },
    )
  }

  const auth = await authorizeOperationalReviewWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const query = await openSnapshotQuery({
      supabase,
      input: body,
      openedBy: auth.userId,
    })
    return NextResponse.json({ ok: true, query })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to open query'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
