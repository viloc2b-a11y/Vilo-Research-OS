import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createRuntimeVisit } from '@/lib/study-runtime-composition/create-runtime-visit'
import { listRuntimeVisits } from '@/lib/study-runtime-composition/list-runtime-visits'
import { authorizeStudyRuntimeRead, authorizeStudyRuntimeWrite } from '@/lib/study-runtime-composition/study-runtime-auth'
import type { CreateRuntimeVisitInput } from '@/lib/study-runtime-composition/runtime-composition-types'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')

  if (!organizationId || !studyId) {
    return NextResponse.json({ error: 'organization_id and study_id are required' }, { status: 400 })
  }

  const auth = await authorizeStudyRuntimeRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const visits = await listRuntimeVisits(supabase, {
      organizationId,
      studyId,
      status: req.nextUrl.searchParams.get('status'),
    })
    return NextResponse.json({ ok: true, visits })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list runtime visits'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: CreateRuntimeVisitInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.visit_code || !body.visit_name || !body.visit_type) {
    return NextResponse.json(
      { error: 'organization_id, study_id, visit_code, visit_name, and visit_type are required' },
      { status: 400 },
    )
  }

  if (body.sequence_order === undefined || body.sequence_order === null) {
    return NextResponse.json({ error: 'sequence_order is required' }, { status: 400 })
  }

  const auth = await authorizeStudyRuntimeWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const visit = await createRuntimeVisit({
      supabase,
      input: body,
      createdBy: auth.userId,
    })
    return NextResponse.json({ ok: true, visit })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create runtime visit'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
