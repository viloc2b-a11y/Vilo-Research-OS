import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapSubjectConsentVersionRow,
  mapSubjectReconsentRequirementRow,
  type SubjectConsentVersionRow,
  type SubjectReconsentRequirementRow,
} from './consent-types'

export async function loadSubjectConsents(args: {
  supabase: SupabaseClient
  organizationId: string
  studySubjectId: string
}): Promise<SubjectConsentVersionRow[]> {
  const { supabase, organizationId, studySubjectId } = args

  const { data, error } = await supabase
    .from('subject_consent_versions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_subject_id', studySubjectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapSubjectConsentVersionRow(r as Record<string, unknown>))
}

export async function loadSubjectReconsentRequirements(args: {
  supabase: SupabaseClient
  organizationId: string
  studySubjectId: string
}): Promise<SubjectReconsentRequirementRow[]> {
  const { supabase, organizationId, studySubjectId } = args

  const { data, error } = await supabase
    .from('subject_consent_reconsent_requirements')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_subject_id', studySubjectId)
    .order('detected_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapSubjectReconsentRequirementRow(r as Record<string, unknown>))
}
