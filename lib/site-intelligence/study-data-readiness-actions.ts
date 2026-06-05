'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import {
  evaluateStudyDataReadiness,
  type StudyDataReadinessMode,
  type StudyDataReadinessResult,
} from './study-data-readiness-adapter'

export type StudyDataReadinessActionResult =
  | { success: true; readiness: StudyDataReadinessResult; reviewId: string; createdAt: string }
  | { success: false; error: string; readiness?: StudyDataReadinessResult | null }

async function executeStudyDataReadinessReview(input: {
  studyId: string
  organizationId: string
  mode: StudyDataReadinessMode
  asOfDate?: string
  subjectId?: string | null
  visitId?: string | null
}): Promise<StudyDataReadinessActionResult> {
  const supabase = await createServerClient()
  const user = await getSessionUser()
  if (!user) {
    return { success: false, error: 'Sign in required.' }
  }

  const readiness = await evaluateStudyDataReadiness({
    supabase,
    studyId: input.studyId,
    organizationId: input.organizationId,
    mode: input.mode,
    asOfDate: input.asOfDate,
    subjectScope: input.subjectId ? { subjectId: input.subjectId } : undefined,
    visitScope: input.visitId ? { visitId: input.visitId } : undefined,
  })

  const { data: review, error } = await supabase
    .from('study_data_readiness_reviews')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId,
      mode: input.mode,
      status: readiness.status,
      summary: readiness,
      created_by: user.id,
    })
    .select('id, created_at')
    .single()

  if (error || !review) {
    return { success: false, error: error?.message ?? 'Failed to save review.', readiness }
  }

  return {
    success: true,
    readiness,
    reviewId: String(review.id),
    createdAt: String(review.created_at),
  }
}

export async function runStudyDataReadinessReviewAction(
  _prevState: StudyDataReadinessActionResult | null,
  formData: FormData,
): Promise<StudyDataReadinessActionResult> {
  try {
    const studyId = String(formData.get('studyId') ?? '')
    const organizationId = String(formData.get('organizationId') ?? '')
    const mode = String(formData.get('mode') ?? 'internal_review') as StudyDataReadinessMode
    const asOfDate = String(formData.get('asOfDate') ?? '').trim() || undefined
    const subjectId = String(formData.get('subjectId') ?? '').trim() || null
    const visitId = String(formData.get('visitId') ?? '').trim() || null

    if (!studyId || !organizationId) {
      return { success: false, error: 'Missing study or organization context.' }
    }

    return executeStudyDataReadinessReview({
      studyId,
      organizationId,
      mode,
      asOfDate,
      subjectId,
      visitId,
    })
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function runStudyDataReadinessReview(input: {
  studyId: string
  organizationId: string
  mode: StudyDataReadinessMode
  asOfDate?: string
  subjectId?: string | null
  visitId?: string | null
}): Promise<StudyDataReadinessActionResult> {
  return executeStudyDataReadinessReview(input)
}

export async function loadLatestStudyDataReadinessReview(input: {
  studyId: string
  organizationId: string
  mode?: StudyDataReadinessMode
}): Promise<{ readiness: StudyDataReadinessResult | null; createdAt: string | null }> {
  const supabase = await createServerClient()
  let query = supabase
    .from('study_data_readiness_reviews')
    .select('summary, created_at')
    .eq('study_id', input.studyId)
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (input.mode) {
    query = query.eq('mode', input.mode)
  }

  const { data, error } = await query.maybeSingle()

  if (error || !data) {
    return { readiness: null, createdAt: null }
  }

  return {
    readiness: data.summary as StudyDataReadinessResult,
    createdAt: String(data.created_at),
  }
}
