import type { SupabaseClient } from '@supabase/supabase-js'
import type { DispensationReviewExecutionMode, PharmacySubjectAssignmentRule } from './types'

export type ActivePharmacyDispensingBlueprint = {
  id: string
  organizationId: string
  studyId: string
  siteId: string | null
  assignment: PharmacySubjectAssignmentRule
  reviewExecutionMode: DispensationReviewExecutionMode
  reviewWindowHours: number | null
  protocolBasis: string
}

export async function loadActivePharmacyDispensingBlueprint(
  supabase: SupabaseClient,
  studyId: string,
  siteId?: string | null,
): Promise<ActivePharmacyDispensingBlueprint> {
  let query = supabase
    .from('pharmacy_runtime_blueprints')
    .select('id,organization_id,study_id,site_id,metadata')
    .eq('study_id', studyId)
    .eq('status', 'active')
    .order('activated_at', { ascending: false })
    .limit(1)

  query = siteId ? query.or(`site_id.eq.${siteId},site_id.is.null`) : query.is('site_id', null)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Active Pharmacy Runtime Blueprint is required for dispensing.')

  const metadata = asRecord(data.metadata)
  const dispensing = asRecord(metadata.dispensing_runtime)
  const assignment = asRecord(dispensing.subject_assignment)
  const review = asRecord(dispensing.dispensation_review_confirmation)

  return {
    id: String(data.id),
    organizationId: String(data.organization_id),
    studyId: String(data.study_id),
    siteId: data.site_id ? String(data.site_id) : null,
    assignment: {
      assignmentRequired: assignment.assignment_required !== false,
      assignmentStrategy: text(assignment.assignment_strategy, 'blueprint_derived'),
      assignmentTiming: text(assignment.assignment_timing, 'before_visit_dispense'),
      randomizationDependency: text(assignment.randomization_dependency, 'protocol_defined'),
      dispensingEligibilityRules: asRecord(assignment.dispensing_eligibility_rules),
    },
    reviewExecutionMode: normalizeReviewMode(review.execution_mode),
    reviewWindowHours: typeof review.review_window_hours === 'number' ? review.review_window_hours : null,
    protocolBasis: text(review.protocol_basis, 'activated Pharmacy Runtime Blueprint'),
  }
}

function normalizeReviewMode(value: unknown): DispensationReviewExecutionMode {
  if (
    value === 'real_time_required'
    || value === 'asynchronous_required'
    || value === 'optional'
    || value === 'not_required'
  ) {
    return value
  }
  return 'not_required'
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}
