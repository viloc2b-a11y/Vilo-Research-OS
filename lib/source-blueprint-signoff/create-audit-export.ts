import type { SupabaseClient } from '@supabase/supabase-js'
import { loadDraftSuggestionById } from '@/lib/source-blueprint-drafting/list-draft-suggestions'
import { loadSourceBlueprintEvidenceById } from '@/lib/source-blueprint-evidence/list-source-blueprint-evidence'
import { loadEvidenceLineage } from '@/lib/source-blueprint-evidence/load-evidence-lineage'
import { loadEvidenceReviewEvents } from '@/lib/source-blueprint-evidence/load-evidence-review-events'
import { computeSourceBlueprintAuditPackageHash } from './audit-package-hash'
import { loadSourceBlueprintSignoffById } from './list-signoffs'
import {
  mapSourceBlueprintAuditExportRow,
  type CreateSourceBlueprintAuditExportInput,
  type SourceBlueprintAuditExportRow,
  type SourceBlueprintAuditPackage,
} from './signoff-types'

export async function createSourceBlueprintAuditExport(
  supabase: SupabaseClient,
  input: CreateSourceBlueprintAuditExportInput,
): Promise<SourceBlueprintAuditExportRow> {
  const signoff = await loadSourceBlueprintSignoffById(
    supabase,
    input.organizationId,
    input.studyId,
    input.signoffId,
  )
  if (!signoff) throw new Error('Sign-off not found.')
  if (signoff.signoffStatus !== 'signed') {
    throw new Error('Only signed source blueprint reviews can be exported.')
  }

  const suggestions = []
  for (const suggestionId of signoff.suggestionIds) {
    const suggestion = await loadDraftSuggestionById(
      supabase,
      input.organizationId,
      input.studyId,
      suggestionId,
    )
    if (suggestion) suggestions.push(suggestion)
  }

  const evidence = []
  const lineage: SourceBlueprintAuditPackage['lineage'] = {}
  const reviewEvents: SourceBlueprintAuditPackage['reviewEvents'] = {}

  for (const evidenceId of signoff.evidenceIds) {
    const row = await loadSourceBlueprintEvidenceById(
      supabase,
      input.organizationId,
      input.studyId,
      evidenceId,
    )
    if (!row) continue
    evidence.push(row)
    lineage[evidenceId] = await loadEvidenceLineage(
      supabase,
      input.organizationId,
      input.studyId,
      evidenceId,
    )
    reviewEvents[evidenceId] = await loadEvidenceReviewEvents(
      supabase,
      input.organizationId,
      input.studyId,
      evidenceId,
    )
  }

  const packageJson: SourceBlueprintAuditPackage = {
    packageType: 'source_blueprint_evidence_drafting_audit',
    packageVersion: 1,
    generatedAt: new Date().toISOString(),
    organizationId: input.organizationId,
    studyId: input.studyId,
    signoff,
    suggestions,
    evidence,
    lineage,
    reviewEvents,
    guardrails: {
      runtimeMutated: false,
      publishedSourceMutated: false,
      reconciliationMutated: false,
      autonomousGeneration: false,
    },
  }
  const packageHash = computeSourceBlueprintAuditPackageHash(packageJson)

  const { data, error } = await supabase
    .from('source_blueprint_audit_exports')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId,
      signoff_id: input.signoffId,
      package_json: packageJson,
      package_hash: packageHash,
      generated_by: input.generatedBy,
      metadata: {
        package_type: packageJson.packageType,
        runtime_mutated: false,
        published_source_mutated: false,
        reconciliation_mutated: false,
      },
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create audit export')
  return mapSourceBlueprintAuditExportRow(data as Record<string, unknown>)
}
