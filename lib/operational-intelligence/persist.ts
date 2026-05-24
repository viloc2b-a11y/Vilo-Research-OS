import type {
  SubjectOperationalIntelligence,
  VisitOperationalIntelligence,
} from '@/lib/operational-intelligence/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function upsertVisitOperationalIntelligence(
  supabase: SupabaseClient,
  intel: VisitOperationalIntelligence,
): Promise<void> {
  const { error } = await supabase.from('visit_operational_intelligence_projections').upsert({
    visit_id: intel.visitId,
    organization_id: intel.organizationId,
    study_id: intel.studyId,
    study_subject_id: intel.studySubjectId,
    computed_at: intel.computedAt,
    intelligence_version: intel.intelligenceVersion,
    coordinator_burden: intel.coordinatorBurden,
    visit_complexity: intel.visitComplexity,
    protocol_friction: intel.protocolFriction,
    runtime_risk: intel.runtimeRisk,
    intelligence_signals: intel.signals,
    burden_score: intel.coordinatorBurden.burdenScore,
    complexity_score: intel.visitComplexity.complexityScore,
    friction_score: intel.protocolFriction.frictionScore,
    risk_score: intel.runtimeRisk.riskScore,
    snapshot: intel.snapshot,
  })

  if (error) throw new Error(error.message)
}

export async function upsertSubjectOperationalIntelligence(
  supabase: SupabaseClient,
  intel: SubjectOperationalIntelligence,
): Promise<void> {
  const { error } = await supabase.from('subject_operational_intelligence_projections').upsert({
    study_subject_id: intel.studySubjectId,
    organization_id: intel.organizationId,
    study_id: intel.studyId,
    computed_at: intel.computedAt,
    intelligence_version: intel.intelligenceVersion,
    coordinator_burden: intel.coordinatorBurden,
    visit_complexity_aggregate: intel.visitComplexityAggregate,
    protocol_friction: intel.protocolFriction,
    runtime_risk: intel.runtimeRisk,
    intelligence_signals: intel.signals,
    burden_score: intel.coordinatorBurden.burdenScore,
    friction_score: intel.protocolFriction.frictionScore,
    risk_score: intel.runtimeRisk.riskScore,
    snapshot: intel.snapshot,
  })

  if (error) throw new Error(error.message)
}
