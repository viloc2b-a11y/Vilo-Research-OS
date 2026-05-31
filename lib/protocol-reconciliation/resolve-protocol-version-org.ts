import type { SupabaseClient } from '@supabase/supabase-js'

export type ProtocolVersionOrgContext = {
  protocolVersionId: string
  organizationId: string
  protocolRuntimeStudyId: string
  versionLabel: string
}

export async function resolveProtocolVersionOrg(
  supabase: SupabaseClient,
  organizationId: string,
  protocolVersionId: string,
): Promise<ProtocolVersionOrgContext | null> {
  const { data: versionData, error: versionError } = await supabase
    .from('protocol_runtime_versions')
    .select('id, version_label, protocol_runtime_study_id')
    .eq('id', protocolVersionId)
    .maybeSingle()

  if (versionError) throw new Error(versionError.message)
  if (!versionData) return null

  const { data: studyData, error: studyError } = await supabase
    .from('protocol_runtime_studies')
    .select('organization_id')
    .eq('id', versionData.protocol_runtime_study_id)
    .maybeSingle()

  if (studyError) throw new Error(studyError.message)
  if (!studyData || String(studyData.organization_id) !== organizationId) return null

  return {
    protocolVersionId: String(versionData.id),
    organizationId,
    protocolRuntimeStudyId: String(versionData.protocol_runtime_study_id),
    versionLabel: String(versionData.version_label),
  }
}
