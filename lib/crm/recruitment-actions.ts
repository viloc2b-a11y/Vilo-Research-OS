import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, getOrganizationMemberships } from '@/lib/auth/session'
import { canManagePatientCRM, canAccessPatientCRM } from '@/lib/rbac/permissions'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { recordLeadStageTransition } from '@/lib/crm/lead-stage-history'
import { linkLeadToSubject } from '@/lib/crm/link-lead-to-subject'

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Auth guards (private)
// ---------------------------------------------------------------------------

async function getAuthedUser() {
  const user = await getSessionUser()
  if (!user) return { user: null, error: 'Unauthenticated' as const }
  return { user, error: null }
}

async function guardManage(organizationId: string): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const { user, error } = await getAuthedUser()
  if (!user) return { ok: false, error: error ?? 'Unauthenticated' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) {
    return { ok: false, error: 'NOT_MEMBER' }
  }
  if (!canAccessPatientCRM(memberships, organizationId)) {
    return { ok: false, error: 'NO_CRM_ACCESS' }
  }
  if (!canManagePatientCRM(memberships, organizationId)) {
    return { ok: false, error: 'FORBIDDEN' }
  }
  return { ok: true, userId: user.id }
}

// ---------------------------------------------------------------------------
// logLeadContactAttemptAction
// ---------------------------------------------------------------------------

/**
 * Logs a contact attempt and increments the lead's contact counter.
 * Auto-transitions lead → contacted when outcome='reached' and stage='lead'.
 */
export async function logLeadContactAttemptAction(
  leadId: string,
  payload: {
    attempt_type: 'call' | 'sms' | 'email'
    outcome: 'reached' | 'no_answer' | 'voicemail' | 'wrong_number' | 'opted_out' | 'rescheduled' | 'other'
    notes?: string
    organizationId?: string
  },
): Promise<ActionResult> {
  try {
    const { user } = await getAuthedUser()
    if (!user) return { ok: false, error: 'Unauthenticated' }

    const supabase = await createServerClient()

    // Fetch current lead to get org + stage (needed for auto-transition and org guard)
    const { data: lead, error: leadError } = await supabase
      .from('patient_leads')
      .select('stage, organization_id')
      .eq('id', leadId)
      .maybeSingle()

    if (leadError || !lead) return { ok: false, error: 'LEAD_NOT_FOUND' }

    const orgId = payload.organizationId ?? String(lead.organization_id)
    const currentStage = String(lead.stage ?? 'lead')

    const guard = await guardManage(orgId)
    if (!guard.ok) return { ok: false, error: guard.error }

    // Insert contact log entry
    const { error: insertError } = await supabase
      .from('patient_lead_contact_log')
      .insert({
        patient_lead_id: leadId,
        organization_id: orgId,
        actor_user_id: user.id,
        attempt_type: payload.attempt_type,
        outcome: payload.outcome,
        notes: payload.notes ?? null,
        attempted_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('[logLeadContactAttemptAction] insert error:', insertError.message)
      return { ok: false, error: 'INSERT_FAILED' }
    }

    // Increment contact_attempts + set last_contacted_at.
    // Supabase JS doesn't support `field = field + 1` inline, so we read
    // the current value and write back. Acceptable at this scale; the lead
    // contact log row is the authoritative record of each attempt.
    const { data: freshLead } = await supabase
      .from('patient_leads')
      .select('contact_attempts')
      .eq('id', leadId)
      .eq('organization_id', orgId)
      .maybeSingle()

    const currentAttempts = Number(freshLead?.contact_attempts ?? 0)

    const { error: counterError } = await supabase
      .from('patient_leads')
      .update({
        contact_attempts: currentAttempts + 1,
        last_contacted_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('organization_id', orgId)

    if (counterError) {
      console.error('[logLeadContactAttemptAction] counter update error:', counterError.message)
      return { ok: false, error: 'UPDATE_FAILED' }
    }

    // Auto-transition: reached + stage=lead → contacted
    if (payload.outcome === 'reached' && currentStage === 'lead') {
      await supabase
        .from('patient_leads')
        .update({ stage: 'contacted' })
        .eq('id', leadId)
        .eq('organization_id', orgId)

      await recordLeadStageTransition({
        supabase,
        organizationId: orgId,
        leadId,
        fromStage: 'lead',
        toStage: 'contacted',
        actorId: user.id,
        reason: 'Contact reached — auto-transition from Recruitment Command Center',
      })
    }

    revalidatePath('/recruitment')
    return { ok: true }
  } catch (err) {
    console.error('[logLeadContactAttemptAction] unexpected error:', err)
    return { ok: false, error: 'UNEXPECTED_ERROR' }
  }
}

// ---------------------------------------------------------------------------
// scheduleLeadFollowUpAction
// ---------------------------------------------------------------------------

/**
 * Sets next_follow_up_at on a patient lead. Rejects past timestamps.
 */
export async function scheduleLeadFollowUpAction(
  leadId: string,
  nextFollowUpAt: string, // ISO datetime, must be >= now
  organizationId?: string,
): Promise<ActionResult> {
  try {
    // Validate: must be in the future
    if (new Date(nextFollowUpAt) <= new Date()) {
      return { ok: false, error: 'Follow-up date must be in the future.' }
    }

    const { user } = await getAuthedUser()
    if (!user) return { ok: false, error: 'Unauthenticated' }

    const supabase = await createServerClient()

    // Resolve orgId if not provided
    let orgId = organizationId
    if (!orgId) {
      const { data: lead } = await supabase
        .from('patient_leads')
        .select('organization_id')
        .eq('id', leadId)
        .maybeSingle()
      if (!lead) return { ok: false, error: 'LEAD_NOT_FOUND' }
      orgId = String(lead.organization_id)
    }

    const guard = await guardManage(orgId)
    if (!guard.ok) return { ok: false, error: guard.error }

    const { error: updateError } = await supabase
      .from('patient_leads')
      .update({ next_follow_up_at: nextFollowUpAt })
      .eq('id', leadId)
      .eq('organization_id', orgId)

    if (updateError) {
      console.error('[scheduleLeadFollowUpAction] error:', updateError.message)
      return { ok: false, error: 'UPDATE_FAILED' }
    }

    revalidatePath('/recruitment')
    return { ok: true }
  } catch (err) {
    console.error('[scheduleLeadFollowUpAction] unexpected error:', err)
    return { ok: false, error: 'UNEXPECTED_ERROR' }
  }
}

// ---------------------------------------------------------------------------
// qualifyLeadAction
// ---------------------------------------------------------------------------

/**
 * Transitions a lead from pre_screen → qualified.
 * Rejects calls where stage is not 'pre_screen'.
 */
export async function qualifyLeadAction(
  leadId: string,
  nextFollowUpAt?: string,
  organizationId?: string,
): Promise<ActionResult> {
  try {
    const { user } = await getAuthedUser()
    if (!user) return { ok: false, error: 'Unauthenticated' }

    const supabase = await createServerClient()

    let orgId = organizationId
    const { data: lead, error: leadError } = await supabase
      .from('patient_leads')
      .select('stage, organization_id')
      .eq('id', leadId)
      .maybeSingle()

    if (leadError || !lead) return { ok: false, error: 'LEAD_NOT_FOUND' }

    orgId = orgId ?? String(lead.organization_id)
    const currentStage = String(lead.stage ?? 'lead')

    const guard = await guardManage(orgId)
    if (!guard.ok) return { ok: false, error: guard.error }

    // Stage guard: only pre_screen may be qualified
    if (currentStage !== 'pre_screen') {
      return { ok: false, error: 'INVALID_STAGE' }
    }

    const { error: stageError } = await supabase
      .from('patient_leads')
      .update({ stage: 'qualified' })
      .eq('id', leadId)
      .eq('organization_id', orgId)

    if (stageError) {
      console.error('[qualifyLeadAction] stage update error:', stageError.message)
      return { ok: false, error: 'UPDATE_FAILED' }
    }

    await recordLeadStageTransition({
      supabase,
      organizationId: orgId,
      leadId,
      fromStage: currentStage,
      toStage: 'qualified',
      actorId: user.id,
      reason: 'Qualified from Recruitment Command Center',
    })

    if (nextFollowUpAt) {
      await supabase
        .from('patient_leads')
        .update({ next_follow_up_at: nextFollowUpAt })
        .eq('id', leadId)
        .eq('organization_id', orgId)
    }

    revalidatePath('/recruitment')
    return { ok: true }
  } catch (err) {
    console.error('[qualifyLeadAction] unexpected error:', err)
    return { ok: false, error: 'UNEXPECTED_ERROR' }
  }
}

// ---------------------------------------------------------------------------
// assignLeadStudyAction
// ---------------------------------------------------------------------------

/**
 * Creates a patient_study_match for a lead.
 * Enforces single-primary invariant at application layer.
 *
 * Primary flag rules:
 *   - No existing matches → new match gets is_primary=true regardless of markPrimary
 *   - markPrimary=true → clear existing primary first, then insert with is_primary=true
 *   - markPrimary=false with existing matches → insert with is_primary=false
 */
export async function assignLeadStudyAction(
  leadId: string,
  studyId: string,
  markPrimary: boolean,
  organizationId?: string,
): Promise<ActionResult<{ matchId: string }>> {
  try {
    const { user } = await getAuthedUser()
    if (!user) return { ok: false, error: 'Unauthenticated' }

    const supabase = await createServerClient()

    let orgId = organizationId
    if (!orgId) {
      const { data: lead } = await supabase
        .from('patient_leads')
        .select('organization_id')
        .eq('id', leadId)
        .maybeSingle()
      if (!lead) return { ok: false, error: 'LEAD_NOT_FOUND' }
      orgId = String(lead.organization_id)
    }

    const guard = await guardManage(orgId)
    if (!guard.ok) return { ok: false, error: guard.error }

    // Check for existing matches to determine primary logic
    const { data: existingMatch } = await supabase
      .from('patient_study_matches')
      .select('id, is_primary')
      .eq('patient_lead_id', leadId)
      .eq('organization_id', orgId)
      .maybeSingle()

    const hasExisting = existingMatch !== null
    const isPrimary = !hasExisting || markPrimary

    // If setting as primary, clear any existing primary first
    if (isPrimary && hasExisting) {
      const { error: clearError } = await supabase
        .from('patient_study_matches')
        .update({ is_primary: false })
        .eq('patient_lead_id', leadId)
        .eq('organization_id', orgId)
        .eq('is_primary', true)

      if (clearError) {
        console.error('[assignLeadStudyAction] clear primary error:', clearError.message)
        return { ok: false, error: 'CLEAR_PRIMARY_FAILED' }
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from('patient_study_matches')
      .insert({
        patient_lead_id: leadId,
        study_id: studyId,
        organization_id: orgId,
        match_status: 'accepted',
        is_primary: isPrimary,
        match_score: 0,
      })
      .select('id')
      .maybeSingle()

    if (insertError || !inserted) {
      console.error('[assignLeadStudyAction] insert error:', insertError?.message)
      return { ok: false, error: 'INSERT_FAILED' }
    }

    revalidatePath('/recruitment')
    return { ok: true, data: { matchId: String(inserted.id) } }
  } catch (err) {
    console.error('[assignLeadStudyAction] unexpected error:', err)
    return { ok: false, error: 'UNEXPECTED_ERROR' }
  }
}

// ---------------------------------------------------------------------------
// convertLeadToSubjectAction
// ---------------------------------------------------------------------------

/**
 * Converts a qualified lead to a study subject by calling linkLeadToSubject.
 * Requires studySubjectId (study_subjects.id UUID) — NOT studyId.
 */
export async function convertLeadToSubjectAction(
  leadId: string,
  studySubjectId: string, // study_subjects.id — NOT studyId
  organizationId?: string,
): Promise<ActionResult<{ subjectId: string }>> {
  try {
    const { user } = await getAuthedUser()
    if (!user) return { ok: false, error: 'Unauthenticated' }

    const supabase = await createServerClient()

    let orgId = organizationId
    if (!orgId) {
      const { data: lead } = await supabase
        .from('patient_leads')
        .select('organization_id')
        .eq('id', leadId)
        .maybeSingle()
      if (!lead) return { ok: false, error: 'LEAD_NOT_FOUND' }
      orgId = String(lead.organization_id)
    }

    const guard = await guardManage(orgId)
    if (!guard.ok) return { ok: false, error: guard.error }

    const result = await linkLeadToSubject({
      supabase,
      organizationId: orgId,
      leadId,
      studySubjectId,
      actorId: user.id,
    })

    if (!result.ok) {
      console.error('[convertLeadToSubjectAction] linkLeadToSubject failed:', result.error)
      return { ok: false, error: result.error }
    }

    revalidatePath('/recruitment')
    return { ok: true, data: { subjectId: studySubjectId } }
  } catch (err) {
    console.error('[convertLeadToSubjectAction] unexpected error:', err)
    return { ok: false, error: 'UNEXPECTED_ERROR' }
  }
}
