import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapProtocolRuntimeAmendmentLinkRow,
  mapProtocolRuntimeProcedureCandidateRow,
  mapProtocolRuntimeSectionRow,
  mapProtocolRuntimeVersionRow,
  mapProtocolRuntimeVisitCandidateRow,
  type LoadedProtocolVersion,
  type ProtocolStatus,
} from './protocol-intake-types'

export async function loadProtocolVersion(
  supabase: SupabaseClient,
  organizationId: string,
  versionId: string,
): Promise<LoadedProtocolVersion | null> {
  // Find version and its parent org by joining through protocol_runtime_studies.
  const { data: versionRow, error: versionError } = await supabase
    .from('protocol_runtime_versions')
    .select('*')
    .eq('id', versionId)
    .maybeSingle()

  if (versionError) throw new Error(versionError.message)
  if (!versionRow) return null

  const { data: studyRow, error: studyError } = await supabase
    .from('protocol_runtime_studies')
    .select('organization_id, protocol_status')
    .eq('id', versionRow.protocol_runtime_study_id)
    .maybeSingle()

  if (studyError) throw new Error(studyError.message)
  if (!studyRow || String(studyRow.organization_id) !== organizationId) return null

  const version = mapProtocolRuntimeVersionRow(versionRow as Record<string, unknown>)

  const [sections, visits, procedures, amendmentLinks] = await Promise.all([
    supabase
      .from('protocol_runtime_sections')
      .select('*')
      .eq('protocol_version_id', versionId)
      .order('sequence_order', { ascending: true }),
    supabase
      .from('protocol_runtime_visit_candidates')
      .select('*')
      .eq('protocol_version_id', versionId)
      .order('created_at', { ascending: true }),
    supabase
      .from('protocol_runtime_procedure_candidates')
      .select('*')
      .eq('protocol_version_id', versionId)
      .order('created_at', { ascending: true }),
    supabase
      .from('protocol_runtime_amendment_links')
      .select('*')
      .or(`previous_protocol_version_id.eq.${versionId},new_protocol_version_id.eq.${versionId}`)
      .order('created_at', { ascending: true }),
  ])

  if (sections.error) throw new Error(sections.error.message)
  if (visits.error) throw new Error(visits.error.message)
  if (procedures.error) throw new Error(procedures.error.message)
  if (amendmentLinks.error) throw new Error(amendmentLinks.error.message)

  return {
    studyProtocolStatus: (studyRow.protocol_status as ProtocolStatus) ?? 'under_review',
    version,
    sections: (sections.data ?? []).map((row) => mapProtocolRuntimeSectionRow(row as Record<string, unknown>)),
    visitCandidates: (visits.data ?? []).map((row) =>
      mapProtocolRuntimeVisitCandidateRow(row as Record<string, unknown>),
    ),
    procedureCandidates: (procedures.data ?? []).map((row) =>
      mapProtocolRuntimeProcedureCandidateRow(row as Record<string, unknown>),
    ),
    amendmentLinks: (amendmentLinks.data ?? []).map((row) =>
      mapProtocolRuntimeAmendmentLinkRow(row as Record<string, unknown>),
    ),
  }
}

