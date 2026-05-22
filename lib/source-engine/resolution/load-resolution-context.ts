/**
 * Loads published source definition metadata for template resolution (Phase 3D).
 */

import { createServerClient } from '@/lib/supabase/server'

export type SourceDefinitionResolutionContext = {
  sourceDefinitionVersionId: string
  studyId: string
  sourceDefinitionId: string
  definitionCode: string
  definitionLabel: string
  lifecycleStatus: string
  versionLabel: string
  meta: Record<string, unknown>
  validationRulesManifest: unknown
  publishedPackageId: string | null
  publishedProvenance: Record<string, unknown> | null
  publishedSourceStatus: string | null
  /** Active manifest field keys for executable continuity checks. */
  publishedFieldKeys: string[]
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

export async function loadSourceDefinitionResolutionContext(
  sourceDefinitionVersionId: string,
): Promise<SourceDefinitionResolutionContext | null> {
  const supabase = await createServerClient()

  const { data: sdv, error } = await supabase
    .from('source_definition_versions')
    .select(
      `
      id,
      study_id,
      lifecycle_status,
      version_label,
      meta,
      validation_rules_manifest,
      source_definition_id,
      source_definitions(code, label)
    `,
    )
    .eq('id', sourceDefinitionVersionId)
    .maybeSingle()

  if (error || !sdv) return null

  const sdRaw = Array.isArray(sdv.source_definitions)
    ? sdv.source_definitions[0]
    : sdv.source_definitions
  const sd = sdRaw as { code?: string; label?: string } | null

  const { data: publishedRows } = await supabase
    .from('published_source_definition_versions')
    .select('package_id, provenance_json, source_status')
    .eq('phase4a_source_definition_version_id', sourceDefinitionVersionId)
    .order('created_at', { ascending: false })
    .limit(1)

  const published = publishedRows?.[0] ?? null

  const { data: fieldRows } = await supabase
    .from('source_fields')
    .select('field_key')
    .eq('source_definition_version_id', sourceDefinitionVersionId)

  return {
    sourceDefinitionVersionId: sdv.id,
    studyId: sdv.study_id,
    sourceDefinitionId: sdv.source_definition_id,
    definitionCode: sd?.code ?? 'unknown',
    definitionLabel: sd?.label ?? 'Source definition',
    lifecycleStatus: sdv.lifecycle_status,
    versionLabel: sdv.version_label,
    meta: asObject(sdv.meta) ?? {},
    validationRulesManifest: sdv.validation_rules_manifest,
    publishedPackageId: (published?.package_id as string | null) ?? null,
    publishedProvenance: asObject(published?.provenance_json),
    publishedSourceStatus: (published?.source_status as string | null) ?? null,
    publishedFieldKeys: (fieldRows ?? [])
      .map((row) => String(row.field_key ?? '').trim())
      .filter(Boolean),
  }
}
