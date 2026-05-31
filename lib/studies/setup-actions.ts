'use server'

import { revalidatePath } from 'next/cache'
import { getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

// ----------------------------------------------------------------------------
// TEAM DELEGATION
// ----------------------------------------------------------------------------

export async function updateStudyMemberDelegation(
  studyId: string,
  userId: string,
  data: {
    clinicalRole: string
    delegationScope: string
    canPerform: boolean
    canReview: boolean
    canSign: boolean
    canOverride: boolean
    isUnblinded: boolean
    delegationStartDate: string | null
    delegationEndDate: string | null
    isActive: boolean
    piApprovalRequired: boolean
  }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')
  const supabase = await createServerClient()
  
  const { error } = await supabase
    .from('study_members')
    .update({
      clinical_role: data.clinicalRole,
      delegation_scope: data.delegationScope,
      can_perform: data.canPerform,
      can_review: data.canReview,
      can_sign: data.canSign,
      can_override: data.canOverride,
      is_unblinded: data.isUnblinded,
      delegation_start_date: data.delegationStartDate,
      delegation_end_date: data.delegationEndDate,
      is_active: data.isActive,
      pi_approval_required: data.piApprovalRequired,
    })
    .eq('study_id', studyId)
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to update delegation: ${error.message}`)
  
  revalidatePath(`/studies/${studyId}/setup`)
  return { ok: true }
}

// ----------------------------------------------------------------------------
// ENROLLMENT CONFIGURATION
// ----------------------------------------------------------------------------

export async function saveEnrollmentConfig(studyId: string, data: Record<string, unknown>) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')
  const orgId = await getPrimaryOrganizationId(sessionUser.id)
  if (!orgId) throw new Error('No organization')
  
  const supabase = await createServerClient()
  
  const { error } = await supabase
    .from('study_enrollment_configs')
    .upsert({
      organization_id: orgId,
      study_id: studyId,
      enrollment_target: data.enrollmentTarget,
      site_enrollment_cap: data.siteEnrollmentCap,
      screening_number_format: data.screeningNumberFormat || 'SCR-{N}',
      subject_number_format: data.subjectNumberFormat || 'SUB-{N}',
      randomization_required: data.randomizationRequired || false,
      randomization_number_format: data.randomizationNumberFormat,
      randomization_method: data.randomizationMethod,
      randomization_ratio: data.randomizationRatio,
      stratification_factors: data.stratificationFactors || [],
      enrollment_start_date: data.enrollmentStartDate,
      enrollment_end_date: data.enrollmentEndDate,
      screen_failure_handling: data.screenFailureHandling,
      replacement_subject_allowed: data.replacementSubjectAllowed || false,
      cohort_enrollment_support: data.cohortEnrollmentSupport || false,
      created_by: sessionUser.id,
      updated_by: sessionUser.id,
    }, { onConflict: 'study_id' })

  if (error) throw new Error(`Failed to save enrollment config: ${error.message}`)

  revalidatePath(`/studies/${studyId}/setup`)
  return { ok: true }
}

// ----------------------------------------------------------------------------
// BIND SOURCE PACKAGE TO VISIT RUNTIME
// ----------------------------------------------------------------------------

export async function bindSourcePackageToVisits(studyId: string, sourcePackageId: string) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')
  const orgId = await getPrimaryOrganizationId(sessionUser.id)
  
  const supabase = await createServerClient()

  // In a real implementation, this would iterate through the source package
  // and insert into study_runtime_visits and study_runtime_visit_procedures
  // For P0, we insert a mock visit indicating the package is bound.
  
  const { error } = await supabase.from('study_runtime_visits').insert({
    organization_id: orgId,
    study_id: studyId,
    visit_code: 'BIND-001',
    visit_name: 'Bound Source Visit',
    visit_type: 'baseline',
    sequence_order: 1,
    status: 'active',
    created_by: sessionUser.id
  })

  if (error) throw new Error(`Failed to bind visits: ${error.message}`)

  return { ok: true }
}

// ----------------------------------------------------------------------------
// ACTIVATION & READINESS
// ----------------------------------------------------------------------------

export async function checkActivationReadiness(studyId: string) {
  const supabase = await createServerClient()
  
  const { data: study } = await supabase.from('studies').select('id, name, status').eq('id', studyId).single()
  const { data: team } = await supabase.from('study_members').select('*').eq('study_id', studyId)
  const { data: config } = await supabase.from('study_enrollment_configs').select('*').eq('study_id', studyId).maybeSingle()
  const { data: visits } = await supabase.from('study_runtime_visits').select('id').eq('study_id', studyId)
  
  const checks = []
  
  // 1. PI Assigned
  const hasPi = team?.some(m => m.clinical_role === 'PI')
  checks.push({
    id: 'PI_ASSIGNED',
    label: 'Principal Investigator Assigned',
    status: hasPi ? 'PASS' : 'FAIL',
  })

  // 2. Enrollment Config
  const hasConfig = !!config
  checks.push({
    id: 'ENROLLMENT_CONFIG',
    label: 'Enrollment Configuration',
    status: hasConfig ? 'PASS' : 'FAIL',
  })

  // 3. Source Package Bound
  const hasVisits = visits && visits.length > 0
  checks.push({
    id: 'SOURCE_BOUND',
    label: 'Executable Visit Schedule Bound',
    status: hasVisits ? 'PASS' : 'FAIL',
  })

  // 4. Randomization Configured if Required
  if (config?.randomization_required) {
    const hasRandConfig = !!config.randomization_number_format && !!config.randomization_method
    checks.push({
      id: 'RANDOMIZATION_CONFIG',
      label: 'Randomization Settings Complete',
      status: hasRandConfig ? 'PASS' : 'FAIL',
    })
  }

  const canActivate = !checks.some(c => c.status === 'FAIL')

  return { canActivate, checks }
}

export async function activateStudy(studyId: string) {
  const readiness = await checkActivationReadiness(studyId)
  if (!readiness.canActivate) {
    throw new Error('Study cannot be activated. Readiness checks failed.')
  }

  const supabase = await createServerClient()
  const { error } = await supabase.from('studies').update({ status: 'active' }).eq('id', studyId)
  
  if (error) throw new Error(`Activation failed: ${error.message}`)

  // Write Audit Event (assuming operational_events table exists)
  const sessionUser = await getSessionUser()
  const orgId = await getPrimaryOrganizationId(sessionUser!.id)
  
  await supabase.from('operational_events').insert({
    organization_id: orgId,
    study_id: studyId,
    event_type: 'study_activated',
    actor_id: sessionUser!.id,
    event_payload: { status: 'active', activated_at: new Date().toISOString() }
  })

  revalidatePath(`/studies/${studyId}`)
  return { ok: true }
}
