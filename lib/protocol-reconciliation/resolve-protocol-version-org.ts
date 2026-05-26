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
  const { data, error } = await supabase
    .from('protocol_runtime_versions')
    .select(
      `
      id,
      version_label,
      protocol_runtime_study_id,
      protocol_runtime_studies!inner (
        organization_id
      )
    `,
    )
    .eq('id', protocolVersionId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const studyRaw = data.protocol_runtime_studies
  const study = (Array.isArray(studyRaw) ? studyRaw[0] : studyRaw) as { organization_id: string } | null
  if (!study || String(study.organization_id) !== organizationId) return null

  return {
    protocolVersionId: String(data.id),
    organizationId,
    protocolRuntimeStudyId: String(data.protocol_runtime_study_id),
    versionLabel: String(data.version_label),
  }
}
