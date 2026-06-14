import type { SupabaseClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { canManageProtocolDeviations } from '@/lib/rbac/permissions'
import { updateCapaAction } from '@/lib/capa-runtime/update-capa-action'
import { loadCapaAction } from '@/lib/capa-runtime/load-capa-actions'
import { appendCapaAuditEvent } from '@/lib/capa-runtime/append-capa-audit-event'
import type { CapaStatus, EffectivenessResult } from '@/lib/capa-runtime/capa-types'

type RouteContext = { params: Promise<{ actionId: string }> }

async function loadCapaActionMeta(supabase: SupabaseClient, actionId: string) {
  const { data, error } = await supabase
    .from('capa_actions')
    .select('id, organization_id')
    .eq('id', actionId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Record<string, unknown> | null
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { actionId } = await context.params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = await createServerClient()

  const capa = await loadCapaActionMeta(supabase, actionId)
  if (!capa) {
    return NextResponse.json({ error: 'CAPA action not found' }, { status: 404 })
  }

  const organizationId = body.organization_id
    ? String(body.organization_id)
    : String(capa.organization_id)

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  if (!canManageProtocolDeviations(auth.memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updateInput: Record<string, unknown> = {}

  if (body.capa_status !== undefined) {
    const cs = String(body.capa_status)
    const validStatuses = ['open', 'in_progress', 'under_review', 'completed', 'verified', 'closed']
    if (!validStatuses.includes(cs)) {
      return NextResponse.json(
        { error: `capa_status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      )
    }
    updateInput.capaStatus = cs as CapaStatus
  }

  if (body.corrective_action !== undefined) {
    updateInput.correctiveAction = String(body.corrective_action)
  }

  if (body.preventive_action !== undefined) {
    updateInput.preventiveAction = body.preventive_action != null ? String(body.preventive_action) : null
  }

  if (body.root_cause_analysis !== undefined) {
    updateInput.rootCauseAnalysis = body.root_cause_analysis != null ? String(body.root_cause_analysis) : null
  }

  if (body.owner_id !== undefined) {
    updateInput.ownerId = body.owner_id != null ? String(body.owner_id) : null
  }

  if (body.due_date !== undefined) {
    updateInput.dueDate = body.due_date != null ? String(body.due_date) : null
  }

  if (body.completion_date !== undefined) {
    updateInput.completionDate = body.completion_date != null ? String(body.completion_date) : null
  }

  if (body.effectiveness_check_required !== undefined) {
    updateInput.effectivenessCheckRequired = Boolean(body.effectiveness_check_required)
  }

  if (body.effectiveness_check_date !== undefined) {
    updateInput.effectivenessCheckDate = body.effectiveness_check_date != null ? String(body.effectiveness_check_date) : null
  }

  if (body.effectiveness_check_result !== undefined) {
    const ecr = body.effectiveness_check_result as string | null
    if (ecr !== null && !['pending', 'pass', 'fail', 'not_applicable'].includes(ecr)) {
      return NextResponse.json(
        { error: 'effectiveness_check_result must be one of: pending, pass, fail, not_applicable' },
        { status: 400 },
      )
    }
    updateInput.effectivenessCheckResult = ecr as EffectivenessResult | null
  }

  if (body.effectiveness_verified_by !== undefined) {
    updateInput.effectivenessVerifiedBy = body.effectiveness_verified_by != null ? String(body.effectiveness_verified_by) : null
  }

  if (body.effectiveness_notes !== undefined) {
    updateInput.effectivenessNotes = body.effectiveness_notes != null ? String(body.effectiveness_notes) : null
  }

  if (body.closed_by !== undefined) {
    updateInput.closedBy = body.closed_by != null ? String(body.closed_by) : null
  }

  if (body.closure_notes !== undefined) {
    updateInput.closureNotes = body.closure_notes != null ? String(body.closure_notes) : null
  }

  if (Object.keys(updateInput).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const note = body.note != null ? String(body.note) : null

  try {
    // Load current status before update so we can record the transition.
    const currentAction = updateInput.capaStatus !== undefined
      ? await loadCapaAction(supabase, actionId, organizationId)
      : null

    const updated = await updateCapaAction(
      supabase,
      actionId,
      organizationId,
      auth.user.id,
      updateInput,
    )

    // Append audit event when the status changed.
    if (
      currentAction !== null &&
      updateInput.capaStatus !== undefined &&
      updateInput.capaStatus !== currentAction.capaStatus
    ) {
      await appendCapaAuditEvent(supabase, {
        organizationId,
        capaId: actionId,
        fromStatus: currentAction.capaStatus,
        toStatus: updated.capaStatus,
        changedBy: auth.user.id,
        note,
      })
    }

    return NextResponse.json({ ok: true, action: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update CAPA action'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
