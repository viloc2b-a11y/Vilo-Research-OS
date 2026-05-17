/**
 * Phase 5.2D — Procedure execution context for capture (navigation metadata only).
 */

import { createServerClient } from '@/lib/supabase/server'

export type ProcedureCaptureContextRow = {
  procedureExecutionId: string
  organizationId: string
  studyId: string
  studyVersionId: string | null
  studySubjectId: string
  visitId: string
  sourceDefinitionVersionId: string
  procedureLabel: string
  visitLabel: string
  subjectLabel: string
  studyName: string
}

export async function loadProcedureCaptureContext(
  procedureExecutionId: string,
): Promise<ProcedureCaptureContextRow | null> {
  const supabase = await createServerClient()

  const { data: pe, error } = await supabase
    .from('procedure_executions')
    .select(
      `
      id,
      organization_id,
      study_id,
      visit_id,
      source_definition_version_id,
      procedure_definitions(code, label),
      visits(
        id,
        study_subject_id,
        scheduled_date,
        visit_definitions(code, label),
        study_subjects(subject_identifier),
        studies(name)
      )
    `,
    )
    .eq('id', procedureExecutionId)
    .maybeSingle()

  if (error || !pe?.source_definition_version_id) {
    return null
  }

  const visitRaw = Array.isArray(pe.visits) ? pe.visits[0] : pe.visits
  if (!visitRaw) return null

  const pdRaw = Array.isArray(pe.procedure_definitions)
    ? pe.procedure_definitions[0]
    : pe.procedure_definitions
  const pd = pdRaw as { code?: string; label?: string } | null

  const vdRaw = Array.isArray(visitRaw.visit_definitions)
    ? visitRaw.visit_definitions[0]
    : visitRaw.visit_definitions
  const vd = vdRaw as { code?: string; label?: string } | null

  const subjectRaw = Array.isArray(visitRaw.study_subjects)
    ? visitRaw.study_subjects[0]
    : visitRaw.study_subjects
  const subject = subjectRaw as { subject_identifier?: string | null } | null

  const studyRaw = Array.isArray(visitRaw.studies) ? visitRaw.studies[0] : visitRaw.studies
  const study = studyRaw as { name?: string } | null

  const { data: sdv } = await supabase
    .from('source_definition_versions')
    .select('study_version_id')
    .eq('id', pe.source_definition_version_id)
    .maybeSingle()

  return {
    procedureExecutionId: pe.id,
    organizationId: pe.organization_id,
    studyId: pe.study_id,
    studyVersionId: sdv?.study_version_id ?? null,
    studySubjectId: visitRaw.study_subject_id,
    visitId: visitRaw.id,
    sourceDefinitionVersionId: pe.source_definition_version_id,
    procedureLabel: pd?.label ?? pd?.code ?? 'Procedure',
    visitLabel: vd?.label ?? vd?.code ?? visitRaw.scheduled_date ?? 'Visit',
    subjectLabel: subject?.subject_identifier ?? 'Subject',
    studyName: study?.name ?? 'Study',
  }
}

export async function findResponseSetIdForProcedure(
  procedureExecutionId: string,
  sourceDefinitionVersionId: string,
): Promise<string | null> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('source_response_sets')
    .select('id')
    .eq('procedure_execution_id', procedureExecutionId)
    .eq('source_definition_version_id', sourceDefinitionVersionId)
    .neq('status', 'archived')
    .maybeSingle()
  return data?.id ?? null
}

export async function resolveStudyVersionIdForOpen(
  studyId: string,
  preferred: string | null,
): Promise<string | null> {
  if (preferred) return preferred
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('study_versions')
    .select('id')
    .eq('study_id', studyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export async function loadFieldOptionsByFieldId(
  fieldIds: string[],
): Promise<Record<string, unknown>> {
  if (fieldIds.length === 0) return {}
  const supabase = await createServerClient()
  const { data } = await supabase.from('source_fields').select('id, options').in('id', fieldIds)
  const out: Record<string, unknown> = {}
  for (const row of data ?? []) {
    out[row.id] = row.options
  }
  return out
}
