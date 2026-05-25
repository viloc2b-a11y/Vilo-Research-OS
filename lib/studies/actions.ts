'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { getSessionUser } from '@/lib/auth/session'
import type { CreateStudyActionState } from '@/lib/studies/create-study-action-state'
import { isOrgAdminForOrganization } from '@/lib/studies/permissions'
import { parseCreateStudyForm } from '@/lib/studies/validate-create-study'
import { createServerClient } from '@/lib/supabase/server'

export async function createStudy(
  _prev: CreateStudyActionState,
  formData: FormData,
): Promise<CreateStudyActionState> {
  const user = await getSessionUser()
  if (!user) {
    return { ok: false, message: 'Sign in required.' }
  }

  const parsed = parseCreateStudyForm(formData)
  if (!parsed.ok) {
    return {
      ok: false,
      message: 'Fix the highlighted fields and try again.',
      fieldErrors: parsed.errors,
    }
  }

  const input = parsed.data
  const access = await requireActiveOrganizationAccess(input.organizationId)
  if (!access.ok) {
    return { ok: false, message: access.message }
  }

  const { memberships } = access
  if (!isOrgAdminForOrganization(memberships, input.organizationId)) {
    return {
      ok: false,
      message: 'Only organization owners or admins can create studies.',
    }
  }

  const supabase = await createServerClient()

  const { data: study, error: studyError } = await supabase
    .from('studies')
    .insert({
      organization_id: input.organizationId,
      name: input.title,
      slug: input.studyCode,
      status: input.status,
    })
    .select('id')
    .single()

  if (studyError || !study) {
    if (studyError?.code === '23505') {
      return {
        ok: false,
        message: 'A study with this code already exists in your organization.',
        fieldErrors: { study_code: 'Study code must be unique within the organization.' },
      }
    }
    return {
      ok: false,
      message: studyError?.message ?? 'Could not create study.',
    }
  }

  const studyId = study.id as string

  const { error: versionError } = await supabase.from('study_versions').insert({
    organization_id: input.organizationId,
    study_id: studyId,
    version_label: 'v1.0',
    protocol_identifier: input.studyCode,
    metadata: {
      sponsor: input.sponsorName,
      phase: input.phase,
      enrollment_target: input.enrollmentTarget,
      operational_profile: {
        title: input.title,
        study_code: input.studyCode,
      },
    },
  })

  if (versionError) {
    return {
      ok: false,
      message: `Study was created but initial version failed: ${versionError.message}`,
    }
  }

  const { error: memberError } = await supabase.from('study_members').insert({
    organization_id: input.organizationId,
    study_id: studyId,
    user_id: user.id,
    role: 'study_admin',
  })

  if (memberError) {
    return {
      ok: false,
      message: `Study was created but roster assignment failed: ${memberError.message}`,
    }
  }

  revalidatePath('/studies')
  revalidatePath(`/studies/${studyId}`)
  revalidatePath(`/studies/${studyId}/workspace`)

  redirect(`/studies/${studyId}/workspace`)
}
