'use server'

import { revalidatePath } from 'next/cache'
import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canMutateOrganizationData } from '@/lib/rbac/permissions'
import {
  parseCommaSeparatedList,
  parseVisitModality,
} from '@/lib/studies/protocol-primitives'
import type { ProtocolSetupActionState } from '@/lib/studies/protocol-setup-action-state'
import { createServerClient } from '@/lib/supabase/server'

function clean(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length ? text : null
}

async function assertCanMutateStudy(organizationId: string, studyId: string) {
  const user = await getSessionUser()
  if (!user) return { ok: false as const, message: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false as const, message: 'You are not a member of this organization.' }
  }
  if (!canMutateOrganizationData(memberships, organizationId)) {
    return { ok: false as const, message: 'Your role is read-only for this organization.' }
  }

  const supabase = await createServerClient()
  const { data: study, error } = await supabase
    .from('studies')
    .select('id')
    .eq('id', studyId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) return { ok: false as const, message: error.message }
  if (!study) return { ok: false as const, message: 'Study not found.' }

  return { ok: true as const, supabase }
}

export async function updateVisitDefinitionProtocolAction(
  _prev: ProtocolSetupActionState,
  formData: FormData,
): Promise<ProtocolSetupActionState> {
  const studyId = clean(formData.get('study_id'))
  const organizationId = clean(formData.get('organization_id'))
  const visitDefinitionId = clean(formData.get('visit_definition_id'))

  if (!studyId || !organizationId || !visitDefinitionId) {
    return { ok: false, message: 'Missing study or visit definition context.' }
  }

  const gate = await assertCanMutateStudy(organizationId, studyId)
  if (!gate.ok) return { ok: false, message: gate.message }

  const eligibleArms = parseCommaSeparatedList(clean(formData.get('eligible_arms')))
  const eligibleSubjectRoles = parseCommaSeparatedList(
    clean(formData.get('eligible_subject_roles')),
  )
  const modality = parseVisitModality(clean(formData.get('modality')))

  const { error } = await gate.supabase
    .from('visit_definitions')
    .update({
      eligible_arms: eligibleArms,
      eligible_subject_roles: eligibleSubjectRoles,
      modality,
    })
    .eq('id', visitDefinitionId)
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  if (error) return { ok: false, message: error.message }

  revalidatePath(`/studies/${studyId}`)
  return { ok: true, message: 'Visit definition protocol fields saved.' }
}

export async function updateProcedureMapProtocolAction(
  _prev: ProtocolSetupActionState,
  formData: FormData,
): Promise<ProtocolSetupActionState> {
  const studyId = clean(formData.get('study_id'))
  const organizationId = clean(formData.get('organization_id'))
  const mapId = clean(formData.get('map_id'))

  if (!studyId || !organizationId || !mapId) {
    return { ok: false, message: 'Missing study or procedure map context.' }
  }

  const gate = await assertCanMutateStudy(organizationId, studyId)
  if (!gate.ok) return { ok: false, message: gate.message }

  const isConditional = formData.get('is_conditional') === 'on'
  const conditionLabel = clean(formData.get('condition_label'))

  const { error } = await gate.supabase
    .from('visit_def_procedure_map')
    .update({
      is_conditional: isConditional,
      condition_label: isConditional ? conditionLabel : null,
    })
    .eq('id', mapId)
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  if (error) return { ok: false, message: error.message }

  revalidatePath(`/studies/${studyId}`)
  return { ok: true, message: 'Procedure map protocol fields saved.' }
}
