import { notFound, redirect } from 'next/navigation'
import { subjectClinicalProfilePath } from '@/lib/ops/paths'
import { createServerClient } from '@/lib/supabase/server'

type LegacyClinicalProfilePageProps = {
  params: Promise<{ subjectId: string }>
}

/**
 * Legacy route — redirects to canonical Subject Workspace tab.
 * Preserves bookmarks and external deep links to /subjects/[id]/clinical-profile.
 */
export default async function LegacyClinicalProfileRedirect({
  params,
}: LegacyClinicalProfilePageProps) {
  const { subjectId } = await params
  const supabase = await createServerClient()

  const { data: subject, error } = await supabase
    .from('study_subjects')
    .select('id, study_id')
    .eq('id', subjectId)
    .maybeSingle()

  if (error || !subject) {
    notFound()
  }

  const studyId = (subject.study_id as string | null) ?? null
  redirect(subjectClinicalProfilePath(studyId, subjectId))
}
