import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

export async function resolveProcedureContext(
  procedureExecutionId: string | null,
  organizationId: string | null,
) {
  if (!procedureExecutionId || !organizationId) {
    return { ok: false as const, error: 'Missing procedure context.' }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false as const, error: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false as const, error: 'You are not a member of this organization.' }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('procedure_executions')
    .select(`
      id,
      organization_id,
      study_id,
      visit_id,
      is_signed,
      is_locked,
      fields_disabled_at,
      fields_disabled_by,
      fields_disabled_reason,
      section_disabled_at,
      section_disabled_by,
      section_disabled_reason,
      validation_status,
      procedure_definitions(is_unblinded)
    `)
    .eq('id', procedureExecutionId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message }
  if (!data) return { ok: false as const, error: 'Procedure not found.' }
  return { ok: true as const, user, supabase, procedure: data }
}
