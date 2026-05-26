import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { assignBlueprintToStudy } from '@/lib/procedure-library/assign-blueprint-to-study'
import { listStudyProcedureBlueprints } from '@/lib/procedure-library/list-study-procedure-blueprints'
import {
  authorizeProcedureLibraryRead,
  authorizeProcedureLibraryWrite,
} from '@/lib/procedure-library/procedure-library-auth'
import type { AssignBlueprintToStudyInput } from '@/lib/procedure-library/procedure-types'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')

  if (!organizationId || !studyId) {
    return NextResponse.json({ error: 'organization_id and study_id are required' }, { status: 400 })
  }

  const auth = await authorizeProcedureLibraryRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const assignments = await listStudyProcedureBlueprints(supabase, organizationId, studyId)
    return NextResponse.json({ ok: true, assignments })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list study procedure blueprints'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: AssignBlueprintToStudyInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.procedure_id || !body.blueprint_version_id) {
    return NextResponse.json(
      { error: 'organization_id, study_id, procedure_id, and blueprint_version_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeProcedureLibraryWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const assignment = await assignBlueprintToStudy({
      supabase,
      input: body,
      createdBy: auth.userId,
    })
    return NextResponse.json({ ok: true, assignment })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign blueprint to study'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
