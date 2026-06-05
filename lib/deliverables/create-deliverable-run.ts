import { SupabaseClient } from '@supabase/supabase-js'
import { DELIVERABLE_DEFINITIONS } from './definitions'
import { logDeliverableAuditEvent } from './audit'
import { DeliverableAudience, DeliverableScope, SubjectScope, VisitScope, ProcedureScope } from './types'

interface CreateDeliverableRunParams {
  systemCode: string
  organizationId: string
  userId: string
  audience: DeliverableAudience
  scope: DeliverableScope
  filters: SubjectScope | VisitScope | ProcedureScope | { studyId: string }
  supabase: SupabaseClient
}

export async function createDeliverableRun(params: CreateDeliverableRunParams) {
  const { systemCode, organizationId, userId, audience, scope, filters, supabase } = params

  // 1. Validate Definition
  const definitionConfig = DELIVERABLE_DEFINITIONS[systemCode]
  if (!definitionConfig) {
    throw new Error(`Deliverable definition not found for code: ${systemCode}`)
  }

  // Find or create definition in DB (simplified for foundation)
  let { data: definition } = await supabase
    .from('deliverable_definitions')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('system_code', systemCode)
    .single()

  if (!definition) {
    const { data: newDef, error: defError } = await supabase
      .from('deliverable_definitions')
      .insert({
        organization_id: organizationId,
        system_code: systemCode,
        name: definitionConfig.name,
        target_audience: definitionConfig.targetAudience,
        allowed_formats: definitionConfig.allowedFormats,
        scope_model: definitionConfig.scopeModel,
        evidence_rules: definitionConfig.evidenceRules,
      })
      .select('id')
      .single()

    if (defError) throw new Error(`Failed to create definition: ${defError.message}`)
    definition = newDef
  }

  // 2. Validate Audience
  if (!definitionConfig.targetAudience.includes(audience)) {
    throw new Error(`Audience ${audience} is not allowed for ${systemCode}`)
  }

  // 3. Validate Scope
  // Basic validation to ensure the required scope matches the definition's scopeModel
  // (Assuming more robust validation in future)
  if (definitionConfig.scopeModel === 'visit' && !('visitInstanceId' in filters)) {
    throw new Error(`Deliverable ${systemCode} requires visit scope.`)
  }

  // 4. Persist Run
  const { data: run, error: runError } = await supabase
    .from('deliverable_runs')
    .insert({
      organization_id: organizationId,
      definition_id: definition.id,
      run_status: 'pending',
      run_by: userId,
    })
    .select('id')
    .single()

  if (runError || !run) {
    throw new Error(`Failed to create run: ${runError?.message}`)
  }

  // 5. Persist Filters
  const { error: filtersError } = await supabase
    .from('deliverable_run_filters')
    .insert({
      run_id: run.id,
      study_id: filters.studyId,
      subject_id: 'subjectId' in filters ? filters.subjectId : null,
      visit_instance_id: 'visitInstanceId' in filters ? filters.visitInstanceId : null,
      options: { scope, audience }, // save extra context
    })

  if (filtersError) {
    // Attempt rollback/cleanup in robust system, skipping for foundation
    throw new Error(`Failed to create run filters: ${filtersError.message}`)
  }

  // 6. Generate Audit Event
  try {
    await logDeliverableAuditEvent({
      supabase,
      runId: run.id,
      action: 'run_created',
      actorId: userId,
      metadata: { definitionId: definition.id, audience, filters }
    })

    return { runId: run.id }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('REQUIRES_REVIEW')) {
      throw error
    }
    throw new Error(`Failed to create deliverable run: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
