'use server'

import { revalidatePath } from 'next/cache'
import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { visitDetailPath } from '@/lib/ops/paths'
import { computeVisitRuntimeAutomation } from '@/lib/runtime-automation/compute-visit'
import { applyVisitRuntimeAutomationPlan } from '@/lib/runtime-automation/execute/apply-plan'
import { overrideRuntimeAutomationExecution } from '@/lib/runtime-automation/execute/override-execution'
import { reverseRuntimeAutomationExecution } from '@/lib/runtime-automation/execute/reverse-execution'
import { loadVisitReadinessProjection } from '@/lib/projections/load'
import { computeVisitReadinessProjection } from '@/lib/projections/compute/visit-readiness'
import { createServerClient } from '@/lib/supabase/server'
import { coordinatorMessageFromError } from '@/lib/runtime-errors'
import type { RuntimeUiActionState } from '@/lib/runtime-ui/actions-state'

function clean(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length ? text : null
}

async function assertCoordinator(organizationId: string | null) {
  if (!organizationId) return { ok: false as const, error: 'Missing organization.' }
  const user = await getSessionUser()
  if (!user) return { ok: false as const, error: 'Sign in required.' }
  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false as const, error: 'You are not a member of this organization.' }
  }
  return { ok: true as const, user }
}

export async function applyVisitAutomationProposalAction(
  _prev: RuntimeUiActionState,
  formData: FormData,
): Promise<RuntimeUiActionState> {
  try {
    return await applyVisitAutomationProposalActionInner(_prev, formData)
  } catch (err) {
    console.error('[applyVisitAutomationProposalAction]', err)
    return {
      ok: false,
      message: coordinatorMessageFromError(err, {
        context: 'runtime_automation_apply',
        fallbackMessage: 'Automation apply failed. Try again.',
      }),
    }
  }
}

async function applyVisitAutomationProposalActionInner(
  _prev: RuntimeUiActionState,
  formData: FormData,
): Promise<RuntimeUiActionState> {
  const organizationId = clean(formData.get('organization_id'))
  const studyId = clean(formData.get('study_id'))
  const visitId = clean(formData.get('visit_id'))
  const actionIdsRaw = clean(formData.get('action_ids'))

  if (!visitId || !studyId) {
    return { ok: false, message: 'Visit and study are required.' }
  }

  const access = await assertCoordinator(organizationId)
  if (!access.ok) return { ok: false, message: access.error }

  const supabase = await createServerClient()
  const readiness = await loadVisitReadinessProjection(supabase, visitId, organizationId!, {
    refreshIfStale: true,
  })
  if (!readiness) return { ok: false, message: 'Could not load visit readiness.' }

  const automation = await computeVisitRuntimeAutomation({
    supabase,
    organizationId: organizationId!,
    studyId,
    visitId,
    readiness,
  })
  if (!automation) return { ok: false, message: 'No automation plan for this visit.' }

  const actionIds = actionIdsRaw ? actionIdsRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined

  const result = await applyVisitRuntimeAutomationPlan({
    supabase,
    automation,
    actorUserId: access.user.id,
    actionIds,
  })

  await computeVisitReadinessProjection(supabase, visitId, organizationId!, {
    persistSafetyGovernance: true,
  })

  revalidatePath(visitDetailPath(visitId))
  revalidatePath(visitDetailPath(visitId, 'workflow'))

  if (result.errors.length > 0) {
    const safeErrors = result.errors.map((raw) =>
      coordinatorMessageFromError(new Error(raw), { context: 'runtime_automation_apply' }),
    )
    return {
      ok: result.applied > 0,
      message: `Applied ${result.applied}; ${safeErrors.join('; ')}`,
    }
  }

  return {
    ok: true,
    message: result.applied > 0 ? `Applied ${result.applied} automation action(s).` : 'Nothing to apply.',
  }
}

export async function reverseVisitAutomationExecutionAction(
  _prev: RuntimeUiActionState,
  formData: FormData,
): Promise<RuntimeUiActionState> {
  try {
    return await reverseVisitAutomationExecutionActionInner(_prev, formData)
  } catch (err) {
    console.error('[reverseVisitAutomationExecutionAction]', err)
    return {
      ok: false,
      message: coordinatorMessageFromError(err, {
        context: 'runtime_automation_reverse',
        fallbackMessage: 'Could not reverse automation.',
      }),
    }
  }
}

async function reverseVisitAutomationExecutionActionInner(
  _prev: RuntimeUiActionState,
  formData: FormData,
): Promise<RuntimeUiActionState> {
  const organizationId = clean(formData.get('organization_id'))
  const visitId = clean(formData.get('visit_id'))
  const executionId = clean(formData.get('execution_id'))

  if (!executionId || !visitId) {
    return { ok: false, message: 'Execution and visit are required.' }
  }

  const access = await assertCoordinator(organizationId)
  if (!access.ok) return { ok: false, message: access.error }

  const supabase = await createServerClient()
  await reverseRuntimeAutomationExecution({
    supabase,
    executionId,
    actorUserId: access.user.id,
  })

  revalidatePath(visitDetailPath(visitId))
  return { ok: true, message: 'Automation reversed.' }
}

export async function overrideVisitAutomationExecutionAction(
  _prev: RuntimeUiActionState,
  formData: FormData,
): Promise<RuntimeUiActionState> {
  try {
    return await overrideVisitAutomationExecutionActionInner(_prev, formData)
  } catch (err) {
    console.error('[overrideVisitAutomationExecutionAction]', err)
    return {
      ok: false,
      message: coordinatorMessageFromError(err, {
        context: 'runtime_automation_override',
        fallbackMessage: 'Could not override automation.',
      }),
    }
  }
}

async function overrideVisitAutomationExecutionActionInner(
  _prev: RuntimeUiActionState,
  formData: FormData,
): Promise<RuntimeUiActionState> {
  const organizationId = clean(formData.get('organization_id'))
  const visitId = clean(formData.get('visit_id'))
  const executionId = clean(formData.get('execution_id'))
  const reason = clean(formData.get('reason'))

  if (!executionId || !visitId) {
    return { ok: false, message: 'Execution and visit are required.' }
  }

  const access = await assertCoordinator(organizationId)
  if (!access.ok) return { ok: false, message: access.error }

  const supabase = await createServerClient()
  await overrideRuntimeAutomationExecution({
    supabase,
    executionId,
    actorUserId: access.user.id,
    reason: reason ?? undefined,
  })

  revalidatePath(visitDetailPath(visitId))
  return { ok: true, message: 'Automation overridden — coordinator has manual control.' }
}
