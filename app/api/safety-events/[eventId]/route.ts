import type { SupabaseClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { canManageSafetyEvents } from '@/lib/rbac/permissions'
import { updateSafetyEvent } from '@/lib/safety-runtime/update-safety-event'
import type { Severity } from '@/lib/safety-runtime/safety-types'
import type { Relatedness } from '@/lib/safety-runtime/safety-types'

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

  if (body.event_status !== undefined) {
    const status = String(body.event_status)
    if (!['open', 'under_review', 'closed'].includes(status)) {
      return NextResponse.json(
        { error: 'event_status must be one of: open, under_review, closed' },
        { status: 400 },
      )
    }
    updateInput.eventStatus = status

    if (status === 'closed') {
      updateInput.closedAt = new Date().toISOString()
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
