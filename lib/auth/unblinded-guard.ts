import { createServerClient } from '@/lib/supabase/server'

export async function canAccessUnblindedStudyArea(userId: string, studyId: string): Promise<boolean> {
  const supabase = await createServerClient()

  // 0. Check Study Configuration
  const { data: study } = await supabase
    .from('studies')
    .select('requires_unblinded_team')
    .eq('id', studyId)
    .single()

  if (!study || study.requires_unblinded_team === false) {
    return false
  }

  // 1. Check if user is an active study member and unblinded
  const { data: member } = await supabase
    .from('study_members')
    .select('is_unblinded, is_active')
    .eq('study_id', studyId)
    .eq('user_id', userId)
    .single()

  if (!member || !member.is_active || !member.is_unblinded) {
    return false
  }

  // 2. Check for an active delegation log
  const { data: delegation } = await supabase
    .from('study_delegation_log')
    .select('id, delegation_status, is_ongoing, delegation_stop_date')
    .eq('study_id', studyId)
    .eq('staff_user_id', userId)
    .eq('delegation_status', 'Active')
    .single()

  if (!delegation) {
    return false
  }

  // 3. Check expiration
  if (!delegation.is_ongoing && delegation.delegation_stop_date) {
    const stopDate = new Date(delegation.delegation_stop_date)
    const now = new Date()
    if (stopDate < now) {
      return false
    }
  }

  // 4. Verify unblinded duty assigned
  const { data: duties } = await supabase
    .from('study_delegation_log_duties')
    .select('duty_id')
    .eq('delegation_log_id', delegation.id)

  if (!duties || duties.length === 0) return false

  const dutyIds = duties.map(d => d.duty_id)
  
  const { data: dutyDefs } = await supabase
    .from('study_delegation_duties')
    .select('unblinded_required')
    .in('id', dutyIds)
    .eq('unblinded_required', true)

  if (!dutyDefs || dutyDefs.length === 0) {
    // Has no duties that require unblinding, meaning they don't actually need unblinded workspace access
    // even if is_unblinded = true. The spec says "unblinded duty assigned".
    return false
  }

  return true
}
