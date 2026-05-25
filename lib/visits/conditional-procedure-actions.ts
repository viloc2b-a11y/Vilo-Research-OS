'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/auth/session'
import { visitDetailPath } from '@/lib/ops/paths'
import { instantiateConditionalProcedureAction } from '@/lib/visits/conditional-procedures'

export type InstantiateConditionalFormState = {
  ok: boolean
  message: string | null
}

export const INITIAL_INSTANTIATE_CONDITIONAL_STATE: InstantiateConditionalFormState = {
  ok: false,
  message: null,
}

export async function instantiateConditionalProcedureFormAction(
  _prev: InstantiateConditionalFormState,
  formData: FormData,
): Promise<InstantiateConditionalFormState> {
  const organizationId = formData.get('organization_id')
  const visitId = formData.get('visit_id')
  const mapId = formData.get('map_id')
  if (
    typeof organizationId !== 'string'
    || typeof visitId !== 'string'
    || typeof mapId !== 'string'
    || !organizationId
    || !visitId
    || !mapId
  ) {
    return { ok: false, message: 'Missing visit or procedure map context.' }
  }

  const user = await getSessionUser()
  if (!user) {
    return { ok: false, message: 'Sign in required to instantiate procedures.' }
  }

  const result = await instantiateConditionalProcedureAction(organizationId, visitId, mapId)
  if (!result.ok) return { ok: false, message: result.error }

  revalidatePath(visitDetailPath(visitId))
  return { ok: true, message: 'Conditional procedure instantiated.' }
}
