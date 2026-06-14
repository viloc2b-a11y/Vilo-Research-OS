import type { SupabaseClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { canManageProtocolDeviations } from '@/lib/rbac/permissions'
import { updateDeviation } from '@/lib/protocol-deviations/update-deviation'
import type { DeviationType, DeviationSeverity } from '@/lib/protocol-deviations/deviation-types'

type RouteContext = { params: Promise<{ deviationId: string }> }

async function loadDeviationMeta(supabase: SupabaseClient, deviationId: string) {
  const { data, error } = await supabase
    .from('protocol_deviations')
    .select('id, organization_id')
    .eq('id', deviationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Record<string, unknown> | null
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { deviationId } = await context.params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = await createServerClient()

  const deviation = await loadDeviationMeta(supabase, deviationId)
  if (!deviation) {
    return NextResponse.json({ error: 'Protocol deviation not found' }, { status: 404 })
  }

  const organizationId = body.organization_id
    ? String(body.organization_id)
    : String(deviation.organization_id)

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  if (!canManageProtocolDeviations(auth.memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updateInput: Record<string, unknown> = {}

  if (body.deviation_type !== undefined) {
    const dt = body.deviation_type as string | null
    const validTypes = ['missed_visit', 'visit_window_violation', 'missed_procedure', 'delayed_procedure', 'subject_noncompliance', 'protocol_exception', 'sponsor_directed', 'other']
    if (dt !== null && !validTypes.includes(dt)) {
      return NextResponse.json(
        { error: `deviation_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      )
    }
    updateInput.deviationType = dt as DeviationType | null
  }

  if (body.status !== undefined) {
    const status = String(body.status)
    const validStatuses = ['candidate', 'pi_review', 'confirmed', 'capa_linked', 'resolved', 'open', 'under_review', 'closed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      )
    }
    updateInput.status = status

    const now = new Date().toISOString()
    if (status === 'closed' || status === 'resolved') {
      updateInput.closedAt = now
    }
    if (status === 'confirmed' || status === 'capa_linked' || status === 'resolved') {
      updateInput.adjudicatedBy = auth.user.id
      updateInput.adjudicatedAt = now
    }
    if (status === 'pi_review' || status === 'open' || status === 'under_review') {
      updateInput.reopenedAt = body.reopen ? now : undefined
    }
  }

  if (body.superseded_by !== undefined) {
    updateInput.supersededBy = body.superseded_by != null ? String(body.superseded_by) : null
  }

  if (body.severity !== undefined) {
    const sev = body.severity as string | null
    if (sev !== null && !['minor', 'major', 'critical'].includes(sev)) {
      return NextResponse.json(
        { error: 'severity must be one of: minor, major, critical' },
        { status: 400 },
      )
    }
    updateInput.severity = sev as DeviationSeverity | null
  }

  if (body.description !== undefined) {
    updateInput.description = String(body.description)
  }

  if (body.root_cause !== undefined) {
    updateInput.rootCause = body.root_cause != null ? String(body.root_cause) : null
  }

  if (body.corrective_action !== undefined) {
    updateInput.correctiveAction = body.corrective_action != null ? String(body.corrective_action) : null
  }

  if (body.preventive_action !== undefined) {
    updateInput.preventiveAction = body.preventive_action != null ? String(body.preventive_action) : null
  }

  if (body.requires_sponsor_notification !== undefined) {
    updateInput.requiresSponsorNotification = Boolean(body.requires_sponsor_notification)
  }

  if (body.requires_irb_notification !== undefined) {
    updateInput.requiresIrbNotification = Boolean(body.requires_irb_notification)
  }

  if (Object.keys(updateInput).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const updated = await updateDeviation(
      supabase,
      deviationId,
      organizationId,
      auth.user.id,
      updateInput,
    )
    return NextResponse.json({ ok: true, deviation: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update protocol deviation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
