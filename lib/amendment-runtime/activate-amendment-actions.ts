import type { SupabaseClient } from '@supabase/supabase-js'

export type ActivationResult = {
  subjectImpactsCreated: number
  subjectImpactsSkipped: number
  trainingRecordId: string | null
  trainingAssignmentsCreated: number
  reconsentRequirementsCreated: number
  workflowActionsCreated: number
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

  // Step 2: Upsert subject impacts — returns id + subject_id for downstream steps
  let subjectImpactsCreated = 0
  let subjectImpactsSkipped = 0
  let newImpacts: Array<{ id: string; subject_id: string }> = []

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
      .select('id, subject_id')

    if (upsertError) {
      throw new Error(`Failed to upsert subject impacts: ${upsertError.message}`)
    }

    newImpacts = (upserted ?? []) as Array<{ id: string; subject_id: string }>
    subjectImpactsCreated = newImpacts.length
    subjectImpactsSkipped = subjectList.length - subjectImpactsCreated
  }

  // Step 3: G3 — Reconsent requirements for newly impacted subjects
  let reconsentRequirementsCreated = 0

  if (requiresReconsent && newImpacts.length > 0) {
    const { data: consentVersion } = await supabase
      .from('consent_document_versions')
      .select('id')
      .eq('study_id', studyId)
      .in('status', ['active', 'irb_approved'])
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (consentVersion) {
      const dueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const reconsentRecords = newImpacts.map((impact) => ({
        organization_id: organizationId,
        study_id: studyId,
        study_subject_id: impact.subject_id,
        consent_document_version_id: consentVersion.id,
        reconsent_status: 'pending',
        reason: impactReason ?? 'Protocol amendment requires updated consent',
        reconsent_due_date: dueDate,
      }))

      const { data: reconsentData, error: reconsentError } = await supabase
        .from('subject_consent_reconsent_requirements')
        .upsert(reconsentRecords, {
          onConflict: 'study_subject_id,consent_document_version_id',
          ignoreDuplicates: true,
        })
        .select('id')

      if (reconsentError) {
        throw new Error(`Failed to create reconsent requirements: ${reconsentError.message}`)
      }

      reconsentRequirementsCreated = reconsentData?.length ?? 0
    }
  }

  // Step 4: G5 — Workflow backbone actions for newly created reconsent impacts
  let workflowActionsCreated = 0

  if (requiresReconsent && newImpacts.length > 0) {
    const dueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const workflowRecords = newImpacts.map((impact) => ({
      organization_id: organizationId,
      study_id: studyId,
      study_subject_id: impact.subject_id,
      action_type: 'amendment_reconsent',
      title: 'Reconsent required — protocol amendment',
      description: impactReason ?? 'Protocol amendment requires updated consent before next visit.',
      priority: 'high',
      assigned_role: 'crc',
      due_date: dueDate,
      sla_days: 21,
      amendment_impact_id: impact.id,
      created_by: actorId,
    }))

    const { data: workflowData, error: workflowError } = await supabase
      .from('subject_workflow_actions')
      .insert(workflowRecords)
      .select('id')

    if (workflowError) {
      throw new Error(`Failed to create workflow actions: ${workflowError.message}`)
    }

    workflowActionsCreated = workflowData?.length ?? 0
  }

  // Step 5: Training record + assignments (G2 — only when training review is required)
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

  // Step 6: G6 — Record activated status in amendment lifecycle table
  const now = new Date().toISOString()
  const { error: statusError } = await supabase
    .from('study_amendment_statuses')
    .upsert(
      {
        organization_id: organizationId,
        study_id: studyId,
        protocol_version_id: protocolVersionId,
        status: 'activated',
        activated_at: now,
        activated_by: actorId,
        updated_at: now,
      },
      { onConflict: 'protocol_version_id' },
    )

  if (statusError) {
    throw new Error(`Failed to record amendment activation status: ${statusError.message}`)
  }

  return {
    subjectImpactsCreated,
    subjectImpactsSkipped,
    trainingRecordId,
    trainingAssignmentsCreated,
    reconsentRequirementsCreated,
    workflowActionsCreated,
  }
}
