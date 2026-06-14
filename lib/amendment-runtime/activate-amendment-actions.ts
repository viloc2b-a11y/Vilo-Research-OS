import type { SupabaseClient } from '@supabase/supabase-js'

export type ActivationResult = {
  subjectImpactsCreated: number
  subjectImpactsSkipped: number
  trainingRecordId: string | null
  trainingAssignmentsCreated: number
}

export async function activateAmendmentActions(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  protocolVersionId: string
  requiresReconsent: boolean
  requiresTrainingReview: boolean
  actorId: string
  impactReason?: string
}): Promise<ActivationResult> {
  const {
    supabase,
    organizationId,
    studyId,
    protocolVersionId,
    requiresReconsent,
    requiresTrainingReview,
    actorId,
    impactReason,
  } = args

  // Step 1: Load all enrolled (non-withdrawn) subjects
  const { data: subjects, error: subjectsError } = await supabase
    .from('study_subjects')
    .select('id')
    .eq('study_id', studyId)
    .neq('status', 'withdrawn')

  if (subjectsError) {
    throw new Error(`Failed to load study subjects: ${subjectsError.message}`)
  }

  const subjectList = subjects ?? []

  // Step 2: Upsert subject impacts — ignoreDuplicates lets us count created vs. skipped
  let subjectImpactsCreated = 0
  let subjectImpactsSkipped = 0

  if (subjectList.length > 0) {
    const records = subjectList.map((s) => ({
      organization_id: organizationId,
      study_id: studyId,
      protocol_version_id: protocolVersionId,
      subject_id: s.id,
      requires_reconsent: requiresReconsent,
      requires_training_review: requiresTrainingReview,
      impact_reason: impactReason ?? 'Protocol amendment requires review',
    }))

    const { data: upserted, error: upsertError } = await supabase
      .from('amendment_subject_impacts')
      .upsert(records, { onConflict: 'protocol_version_id,subject_id', ignoreDuplicates: true })
      .select('id')

    if (upsertError) {
      throw new Error(`Failed to upsert subject impacts: ${upsertError.message}`)
    }

    subjectImpactsCreated = upserted?.length ?? 0
    subjectImpactsSkipped = subjectList.length - subjectImpactsCreated
  }

  // Step 3: Training record + assignments (only when training review is required)
  let trainingRecordId: string | null = null
  let trainingAssignmentsCreated = 0

  if (requiresTrainingReview) {
    const { data: training, error: trainingError } = await supabase
      .from('study_protocol_trainings')
      .insert({
        organization_id: organizationId,
        study_id: studyId,
        training_type: 'amendment_review',
        training_title: 'Protocol Amendment Training',
        training_method: 'Self-review',
        related_protocol_version: protocolVersionId,
        created_by: actorId,
      })
      .select('id')
      .single()

    if (trainingError) {
      throw new Error(`Failed to create training record: ${trainingError.message}`)
    }

    trainingRecordId = training.id as string

    // Load active staff
    const { data: staff, error: staffError } = await supabase
      .from('study_delegation_log')
      .select('staff_user_id')
      .eq('study_id', studyId)
      .eq('delegation_status', 'Active')

    if (staffError) {
      throw new Error(`Failed to load active staff: ${staffError.message}`)
    }

    const staffList = staff ?? []

    if (staffList.length > 0) {
      const assignmentRecords = staffList.map((s) => ({
        organization_id: organizationId,
        training_id: trainingRecordId,
        trainee_user_id: s.staff_user_id,
        training_status: 'Assigned',
      }))

      const { data: assignments, error: assignmentError } = await supabase
        .from('study_protocol_training_assignments')
        .upsert(assignmentRecords, { onConflict: 'training_id,trainee_user_id', ignoreDuplicates: true })
        .select('id')

      if (assignmentError) {
        throw new Error(`Failed to create training assignments: ${assignmentError.message}`)
      }

      trainingAssignmentsCreated = assignments?.length ?? 0
    }
  }

  return {
    subjectImpactsCreated,
    subjectImpactsSkipped,
    trainingRecordId,
    trainingAssignmentsCreated,
  }
}
