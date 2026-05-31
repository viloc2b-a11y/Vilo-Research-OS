'use server'

import { revalidatePath } from 'next/cache'
import { getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

export async function verifyStaffQualificationAndActivateDelegation(delegationLogId: string) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')
  
  const supabase = await createServerClient()
  
  // 1. Get Delegation Log and Duties
  const { data: log } = await supabase.from('study_delegation_log')
    .select('*, study_id, staff_user_id')
    .eq('id', delegationLogId)
    .single()
    
  if (!log) throw new Error('Delegation not found')
  
  const { data: duties } = await supabase.from('study_delegation_log_duties')
    .select('duty_id')
    .eq('delegation_log_id', delegationLogId)
    
  // 2. Check if any duty requires training
  let requiresTraining = false
  if (duties && duties.length > 0) {
    const dutyIds = duties.map(d => d.duty_id)
    const { data: dutyDefs } = await supabase.from('study_delegation_duties')
      .select('requires_training')
      .in('id', dutyIds)
    requiresTraining = dutyDefs?.some(d => d.requires_training) || false
  }

  // 3. Training <-> Delegation Validation
  if (requiresTraining) {
    const { data: matrix } = await supabase.from('vw_study_training_matrix')
      .select('is_eligible')
      .eq('study_id', log.study_id)
      .eq('trainee_user_id', log.staff_user_id)
      
    const hasIneligibleTraining = matrix?.some(m => !m.is_eligible)
    const hasAnyTraining = matrix && matrix.length > 0
    
    if (hasIneligibleTraining || !hasAnyTraining) {
      throw new Error('Validation Failed: Required training is missing, incomplete, or unsigned.')
    }
  }

  // 4. Update Delegation Log Status and Details
  const now = new Date().toISOString()
  const { error } = await supabase.from('study_delegation_log').update({
    delegation_status: 'Active',
    qualification_verified_by: sessionUser.id,
    qualification_verification_date: now.split('T')[0],
    pi_signed_at: now // implicitly signing if PI is acting
  }).eq('id', delegationLogId)

  if (error) throw new Error(`Activation failed: ${error.message}`)

  revalidatePath(`/studies/${log.study_id}/delegation`)
  return { ok: true }
}

export async function updateStaffInitials(delegationLogId: string, initials: string) {
  const supabase = await createServerClient()
  const { error } = await supabase.from('study_delegation_log').update({
    staff_initials: initials,
    initials_verification: true
  }).eq('id', delegationLogId)
  
  if (error) throw new Error(error.message)
  return { ok: true }
}
