import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { canManageProtocolDeviations } from '@/lib/rbac/permissions'
import { createDeviation } from '@/lib/protocol-deviations/create-deviation'
import type { DeviationType, DeviationSeverity } from '@/lib/protocol-deviations/deviation-types'

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

  if (!organizationId || !studyId || !subjectId) {
    return NextResponse.json(
      { error: 'organization_id, study_id, and subject_id are required' },
      { status: 400 },
    )
  }

  const deviationType = body.deviation_type as string | undefined
  if (!deviationType) {
    return NextResponse.json(
      { error: 'deviation_type is required' },
      { status: 400 },
    )
  }

  const validTypes = ['missed_visit', 'visit_window_violation', 'missed_procedure', 'delayed_procedure', 'subject_noncompliance', 'protocol_exception', 'sponsor_directed', 'other']
  if (!validTypes.includes(deviationType)) {
    return NextResponse.json(
      { error: `deviation_type must be one of: ${validTypes.join(', ')}` },
      { status: 400 },
    )
  }

  const severity = body.severity as string | undefined
  if (!severity || !['minor', 'major', 'critical'].includes(severity)) {
    return NextResponse.json(
      { error: 'severity must be one of: minor, major, critical' },
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

  if (!canManageProtocolDeviations(auth.memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createServerClient()

  try {
    const deviation = await createDeviation(supabase, auth.user.id, {
      organizationId,
      studyId,
      subjectId,
      visitId: (body.visit_id as string) ?? null,
      deviationType: deviationType as DeviationType,
      severity: severity as DeviationSeverity,
      description: body.description as string,
      rootCause: (body.root_cause as string) ?? null,
      correctiveAction: (body.corrective_action as string) ?? null,
      preventiveAction: (body.preventive_action as string) ?? null,
      requiresSponsorNotification: body.requires_sponsor_notification as boolean | undefined,
      requiresIrbNotification: body.requires_irb_notification as boolean | undefined,
      metadata: (body.metadata as Record<string, unknown>) ?? {},
    })

    return NextResponse.json({ ok: true, deviation })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
