import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { listVisitSnapshots } from '@/lib/visit-runtime-locking/list-visit-snapshots'
import { authorizeVisitRuntimeRead } from '@/lib/visit-runtime-locking/visit-locking-auth'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')
  const subjectId = req.nextUrl.searchParams.get('subject_id')

  if (!organizationId || !studyId || !subjectId) {
    return NextResponse.json(
      { error: 'organization_id, study_id, and subject_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeVisitRuntimeRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const snapshots = await listVisitSnapshots(supabase, organizationId, studyId, subjectId)
    return NextResponse.json({ ok: true, snapshots })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list visit snapshots'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
