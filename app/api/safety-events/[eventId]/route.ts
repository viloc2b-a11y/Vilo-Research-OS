import type { SupabaseClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { canManageSafetyEvents } from '@/lib/rbac/permissions'
import { updateSafetyEvent } from '@/lib/safety-runtime/update-safety-event'
import type { Severity, Relatedness, SaeOutcome } from '@/lib/safety-runtime/safety-types'

type RouteContext = { params: Promise<{ eventId: string }> }

async function loadEvent(supabase: SupabaseClient, eventId: string) {
  const { data, error } = await supabase
    .from('safety_events')
    .select('id, organization_id')
    .eq('id', eventId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Record<string, unknown> | null
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { eventId } = await context.params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = await createServerClient()

  const event = await loadEvent(supabase, eventId)
  if (!event) {
    return NextResponse.json({ error: 'Safety event not found' }, { status: 404 })
  }

  const organizationId = body.organization_id
    ? String(body.organization_id)
    : String(event.organization_id)

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  if (!canManageSafetyEvents(auth.memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updateInput: Record<string, unknown> = {}
  const currentEvent = event as Record<string, unknown>

  if (body.event_type !== undefined) {
    const et = body.event_type as string | null
    if (et !== null && !['ae', 'sae'].includes(et)) {
      return NextResponse.json(
        { error: 'event_type must be "ae", "sae", or null' },
        { status: 400 },
      )
    }
    updateInput.eventType = et

    const wasNull = currentEvent.event_type == null
    if (wasNull && et != null) {
      updateInput.eventStatus = 'open'
      updateInput.closedAt = null
    }
  }

  if (body.event_status !== undefined) {
    const status = String(body.event_status)
    if (!['candidate', 'open', 'under_review', 'closed'].includes(status)) {
      return NextResponse.json(
        { error: 'event_status must be one of: candidate, open, under_review, closed' },
        { status: 400 },
      )
    }
    updateInput.eventStatus = status

    if (status === 'closed') {
      updateInput.closedAt = new Date().toISOString()
    }

    if (status === 'candidate') {
      updateInput.eventType = null
    }
  }

  if (body.description !== undefined) {
    updateInput.description = String(body.description)
  }

  if (body.severity !== undefined) {
    const sev = body.severity as string | null
    if (sev !== null && !['mild', 'moderate', 'severe'].includes(sev)) {
      return NextResponse.json(
        { error: 'severity must be one of: mild, moderate, severe' },
        { status: 400 },
      )
    }
    updateInput.severity = sev as Severity | null
  }

  if (body.relatedness !== undefined) {
    const rel = body.relatedness as string | null
    if (rel !== null && !['unrelated', 'unlikely', 'possible', 'probable', 'definite'].includes(rel)) {
      return NextResponse.json(
        { error: 'relatedness must be one of: unrelated, unlikely, possible, probable, definite' },
        { status: 400 },
      )
    }
    updateInput.relatedness = rel as Relatedness | null
  }

  if (body.requires_follow_up !== undefined) {
    updateInput.requiresFollowUp = Boolean(body.requires_follow_up)
  }

  const SAE_OUTCOMES = ['recovered', 'recovering', 'not_recovered', 'fatal', 'unknown', 'not_applicable']

  if (body.outcome !== undefined) {
    const out = body.outcome as string | null
    if (out !== null && !SAE_OUTCOMES.includes(out)) {
      return NextResponse.json({ error: `outcome must be one of: ${SAE_OUTCOMES.join(', ')}` }, { status: 400 })
    }
    updateInput.outcome = out as SaeOutcome | null
  }
  if (body.resolution_description !== undefined) {
    updateInput.resolutionDescription = body.resolution_description != null ? String(body.resolution_description) : null
  }
  if (body.sponsor_notified_at !== undefined) {
    updateInput.sponsorNotifiedAt = body.sponsor_notified_at != null ? String(body.sponsor_notified_at) : null
  }
  if (body.sponsor_notification_required !== undefined) {
    updateInput.sponsorNotificationRequired = Boolean(body.sponsor_notification_required)
  }
  if (body.follow_up_due_date !== undefined) {
    updateInput.followUpDueDate = body.follow_up_due_date != null ? String(body.follow_up_due_date) : null
  }
  if (body.follow_up_completed_at !== undefined) {
    updateInput.followUpCompletedAt = body.follow_up_completed_at != null ? String(body.follow_up_completed_at) : null
  }
  if (body.regulatory_reporting_required !== undefined) {
    updateInput.regulatoryReportingRequired = Boolean(body.regulatory_reporting_required)
  }
  if (body.expedited_report_submitted_at !== undefined) {
    updateInput.expeditedReportSubmittedAt = body.expedited_report_submitted_at != null ? String(body.expedited_report_submitted_at) : null
  }
  if (body.reporting_deadline_date !== undefined) {
    updateInput.reportingDeadlineDate = body.reporting_deadline_date != null ? String(body.reporting_deadline_date) : null
  }

  if (Object.keys(updateInput).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const updated = await updateSafetyEvent(
      supabase,
      eventId,
      organizationId,
      auth.user.id,
      updateInput,
    )
    return NextResponse.json({ ok: true, event: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update safety event'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
