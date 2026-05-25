import { persistDerivedProjectionSafe } from '@/lib/projections/runtime-projection-persist'
import type {
  SubjectOperationalIntelligence,
  VisitOperationalIntelligence,
} from '@/lib/operational-intelligence/types'

export async function upsertVisitOperationalIntelligence(
  intel: VisitOperationalIntelligence,
): Promise<void> {
  await persistDerivedProjectionSafe(
    {
      table: 'visit_operational_intelligence_projections',
      organizationId: intel.organizationId,
      studyId: intel.studyId,
      studySubjectId: intel.studySubjectId,
      visitId: intel.visitId,
    },
    async (supabase) => {
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
      return { error }
    },
  )
}

export async function upsertSubjectOperationalIntelligence(
  intel: SubjectOperationalIntelligence,
): Promise<void> {
  await persistDerivedProjectionSafe(
    {
      table: 'subject_operational_intelligence_projections',
      organizationId: intel.organizationId,
      studyId: intel.studyId,
      studySubjectId: intel.studySubjectId,
    },
    async (supabase) => {
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
      return { error }
    },
  )
}
