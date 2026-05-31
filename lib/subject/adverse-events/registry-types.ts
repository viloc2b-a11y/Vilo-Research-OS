export type AdverseEventLifecycleStatus = 'open' | 'follow_up' | 'resolved' | 'closed'

export type SubjectAdverseEventSeverity =
  | 'mild'
  | 'moderate'
  | 'severe'
  | 'life-threatening'
  | 'unknown'

export type SubjectAdverseEventRelationship =
  | 'related'
  | 'possibly_related'
  | 'not_related'
  | 'unlikely'
  | 'unknown'

export type SubjectAdverseEventRecord = {
  ae_id: string
  organization_id: string
  study_subject_id: string
  visit_id: string | null
  event_term: string
  preferred_term: string | null
  ae_type: string | null
  severity: SubjectAdverseEventSeverity | null
  seriousness: boolean
  relationship_to_ip: SubjectAdverseEventRelationship | null
  expectedness: string | null
  action_taken: string | null
  outcome: string | null
  ongoing: boolean
  requires_pi_si_review: boolean
  lifecycle_status: AdverseEventLifecycleStatus
  onset_date: string | null
  resolution_date: string | null
  source_attribution: string | null
  comments: string | null
  created_at: string
  updated_at: string
}

export type SubjectAdverseEventInput = {
  visit_id?: string | null
  event_term: string
  preferred_term?: string | null
  ae_type?: string | null
  severity?: SubjectAdverseEventSeverity | null
  seriousness?: boolean
  relationship_to_ip?: SubjectAdverseEventRelationship | null
  expectedness?: string | null
  action_taken?: string | null
  outcome?: string | null
  ongoing?: boolean
  requires_pi_si_review?: boolean
  lifecycle_status?: AdverseEventLifecycleStatus
  onset_date?: string | null
  resolution_date?: string | null
  source_attribution?: string | null
  comments?: string | null
}

export type SubjectAdverseEventVisitOption = {
  id: string
  label: string
}
