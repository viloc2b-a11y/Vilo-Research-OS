import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapProtocolRuntimeStudyRow,
  mapProtocolRuntimeVersionRow,
  type LoadedProtocolRuntimeStudy,
} from './protocol-intake-types'

export async function loadProtocolRuntimeStudy(
  supabase: SupabaseClient,
  organizationId: string,
  protocolRuntimeStudyId: string,
): Promise<LoadedProtocolRuntimeStudy | null> {
  const { data: studyRow, error: studyError } = await supabase
    .from('protocol_runtime_studies')
    .select('*')
    .eq('id', protocolRuntimeStudyId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (studyError) throw new Error(studyError.message)
  if (!studyRow) return null

  const { data: versionRows, error: versionError } = await supabase
    .from('protocol_runtime_versions')
    .select('*')
    .eq('protocol_runtime_study_id', protocolRuntimeStudyId)
    .order('created_at', { ascending: false })

  if (versionError) throw new Error(versionError.message)

  const versions = (versionRows ?? []).map((row) =>
    mapProtocolRuntimeVersionRow(row as Record<string, unknown>),
  )

  const latestVersion =
    versions.find((v) => v.id === String(studyRow.current_protocol_version_id ?? '')) ?? versions[0] ?? null

  const extractionSummary = await Promise.all(
    versions.map(async (version) => {
      const [sections, visits, procedures] = await Promise.all([
        supabase
          .from('protocol_runtime_sections')
          .select('id', { count: 'exact', head: true })
          .eq('protocol_version_id', version.id),
        supabase
          .from('protocol_runtime_visit_candidates')
          .select('id', { count: 'exact', head: true })
          .eq('protocol_version_id', version.id),
        supabase
          .from('protocol_runtime_procedure_candidates')
          .select('id', { count: 'exact', head: true })
          .eq('protocol_version_id', version.id),
      ])

      return {
        versionId: version.id,
        extractionStatus: version.extractionStatus,
        sections: sections.count ?? 0,
        visits: visits.count ?? 0,
        procedures: procedures.count ?? 0,
      }
    }),
  )

  return {
    study: mapProtocolRuntimeStudyRow(studyRow as Record<string, unknown>),
    versions,
    latestVersion,
    extractionSummary,
  }
}

