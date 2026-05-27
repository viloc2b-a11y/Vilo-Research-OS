import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { answerSnapshotQuery } from '@/lib/operational-review/answer-snapshot-query'
import { authorizeOperationalReviewWrite } from '@/lib/operational-review/operational-review-auth'

type RouteContext = { params: Promise<{ queryId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { queryId } = await context.params
  let body: { organization_id?: string; answer_text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.answer_text) {
    return NextResponse.json(
      { error: 'organization_id and answer_text are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeOperationalReviewWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const query = await answerSnapshotQuery({
      supabase,
      organizationId: body.organization_id,
      queryId,
      actorId: auth.userId,
      answerText: body.answer_text,
    })
    return NextResponse.json({ ok: true, query })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to answer query'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
