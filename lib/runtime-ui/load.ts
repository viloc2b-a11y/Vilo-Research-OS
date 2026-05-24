import { computeVisitReadinessProjection } from '@/lib/projections/compute/visit-readiness'
import { computeSubjectRuntimeProjection } from '@/lib/projections/compute/subject-runtime'
import { loadVisitReadinessProjection, loadSubjectRuntimeProjection } from '@/lib/projections/load'
import {
  observeSubjectRuntimeUiModelLoaded,
  observeVisitRuntimeUiModelLoaded,
} from '@/lib/observability/hooks/observe-runtime-ui-load'
import { mapVisitRuntimeUiModel } from '@/lib/runtime-ui/map-visit-runtime-ui'
import { mapSubjectRuntimeUiModel } from '@/lib/runtime-ui/map-subject-runtime-ui'
import type { VisitRuntimeUiModel, SubjectRuntimeUiModel } from '@/lib/runtime-ui/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function loadVisitRuntimeUiModel(
  supabase: SupabaseClient,
  visitId: string,
  organizationId: string,
  options?: { refresh?: boolean },
): Promise<VisitRuntimeUiModel | null> {
  const readiness =
    options?.refresh === false
      ? await loadVisitReadinessProjection(supabase, visitId, organizationId, {
          refreshIfStale: false,
        })
      : await computeVisitReadinessProjection(supabase, visitId, organizationId, {
          persistSafetyGovernance: true,
        })

  if (!readiness) return null

  const [orchResult, autoResult] = await Promise.all([
    supabase
      .from('visit_coordinator_orchestration_projections')
      .select('next_actions, work_queue, urgency, visit_execution, blocker_chains')
      .eq('visit_id', visitId)
      .maybeSingle(),
    supabase
      .from('visit_runtime_automation_projections')
      .select('proposed_actions, pending_apply_count, automation_plan')
      .eq('visit_id', visitId)
      .maybeSingle(),
  ])

  const model = mapVisitRuntimeUiModel({
    readiness,
    orchestration: orchResult.data as Record<string, unknown> | null,
    automation: autoResult.data as Record<string, unknown> | null,
  })
  if (model) {
    observeVisitRuntimeUiModelLoaded({ supabase, model })
  }
  return model
}

export async function loadSubjectRuntimeUiModel(
  supabase: SupabaseClient,
  studySubjectId: string,
  organizationId: string,
  options?: { refresh?: boolean },
): Promise<SubjectRuntimeUiModel | null> {
  const subject =
    options?.refresh === false
      ? await loadSubjectRuntimeProjection(supabase, studySubjectId, organizationId, {
          refreshIfStale: false,
        })
      : await computeSubjectRuntimeProjection(supabase, studySubjectId, organizationId, {
          persistOperationalIntelligence: true,
        })

  if (!subject) return null

  const { data: auto } = await supabase
    .from('subject_runtime_automation_projections')
    .select('proposed_actions, pending_apply_count')
    .eq('study_subject_id', studySubjectId)
    .maybeSingle()

  const model = mapSubjectRuntimeUiModel({
    subject,
    automation: auto as Record<string, unknown> | null,
  })
  if (model) {
    observeSubjectRuntimeUiModelLoaded({ supabase, model })
  }
  return model
}
