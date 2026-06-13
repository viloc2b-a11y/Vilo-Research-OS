import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { canManageSafetyEvents } from '@/lib/rbac/permissions'
import { createSafetyEvent } from '@/lib/safety-runtime/create-safety-event'
import type { Severity, Relatedness } from '@/lib/safety-runtime/safety-types'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const organizationId = body.organization_id as string | undefined
  const studyId = body.study_id as string | undefined
  const subjectId = body.subject_id as string | undefined
  const eventType = body.event_type as string | undefined

  if (!organizationId || !studyId || !subjectId || !eventType) {
    return NextResponse.json(
      { error: 'organization_id, study_id, subject_id, and event_type are required' },
      { status: 400 },
    )
  }

  if (eventType !== 'ae' && eventType !== 'sae') {
    return NextResponse.json(
      { error: 'event_type must be "ae" or "sae"' },
      { status: 400 },
    )
  }

  if (!body.description) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  if (!canManageSafetyEvents(auth.memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const metadata: Record<string, unknown> = {
    ...(body.metadata as Record<string, unknown> | undefined) ?? {},
  }

  const sourceReferenceId = body.source_reference_id as string | undefined
  if (sourceReferenceId) metadata.source_reference_id = sourceReferenceId

  const labTestCode = body.lab_test_code as string | undefined
  if (labTestCode) metadata.lab_test_code = labTestCode

  const labTestName = body.lab_test_name as string | undefined
  if (labTestName) metadata.lab_test_name = labTestName

  const piClassification = body.pi_classification as string | undefined
  if (piClassification) metadata.pi_classification = piClassification

  const sourceDocumentId = body.source_document_id as string | undefined
  if (sourceDocumentId) metadata.source_document_id = sourceDocumentId

  const supabase = await createServerClient()

  try {
    const event = await createSafetyEvent(supabase, auth.user.id, {
      organizationId,
      studyId,
      subjectId,
      visitId: (body.visit_id as string) ?? null,
      eventType: eventType as 'ae' | 'sae',
      sourceType: 'lab_signal',
      description: body.description as string,
      severity: (body.severity as Severity) ?? null,
      relatedness: (body.relatedness as Relatedness) ?? null,
      requiresFollowUp: body.requires_follow_up as boolean | undefined,
      metadata,
    })

    return NextResponse.json({ ok: true, event })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
