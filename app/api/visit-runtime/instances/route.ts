import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createVisitInstanceFromShell } from '@/lib/visit-runtime-execution/create-visit-instance-from-shell'
import { listVisitInstances } from '@/lib/visit-runtime-execution/list-visit-instances'
import {
  authorizeVisitRuntimeRead,
  authorizeVisitRuntimeWrite,
} from '@/lib/visit-runtime-execution/visit-runtime-auth'
import type { CreateVisitInstanceInput } from '@/lib/visit-runtime-execution/visit-runtime-types'

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
    const instances = await listVisitInstances(supabase, organizationId, studyId, subjectId)
    return NextResponse.json({ ok: true, instances })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list visit instances'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: CreateVisitInstanceInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.subject_id || !body.visit_shell_id) {
    return NextResponse.json(
      {
        error:
          'organization_id, study_id, subject_id, and visit_shell_id are required',
      },
      { status: 400 },
    )
  }

  if (!body.source_publication_id && !body.source_package_id) {
    return NextResponse.json(
      { error: 'source_publication_id (preferred) or source_package_id (legacy) is required' },
      { status: 400 },
    )
  }

  const auth = await authorizeVisitRuntimeWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const allowLegacy =
    process.env.VISIT_RUNTIME_ALLOW_UNPUBLISHED_SOURCE === '1' || process.env.NODE_ENV !== 'production'

  if (!body.source_publication_id && !allowLegacy) {
    return NextResponse.json(
      { error: 'Visit runtime execution requires a published source package.' },
      { status: 400 },
    )
  }

  const supabase = await createServerClient()
  try {
    const result = await createVisitInstanceFromShell({
      supabase,
      input: body,
      createdBy: auth.userId,
      allowUnpublishedSource: allowLegacy,
    })
    return NextResponse.json({
      ok: true,
      visit_instance_id: result.visitInstance.id,
      visit_instance: result.visitInstance,
      procedure_instances: result.procedureInstances,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create visit instance'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
