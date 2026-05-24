'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { ClinicalMutationGateway } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { publishProtocolGraph } from '@/lib/protocol-graph/publish'
import { createServerClient } from '@/lib/supabase/server'
import { canPublishSource } from '@/lib/rbac/permissions'

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function parseJsonField(formData: FormData, key: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const text = formText(formData, key)
  if (!text) return { ok: false, error: `${key} is required.` }
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch (error) {
    return {
      ok: false,
      error: `${key} is not valid JSON: ${error instanceof Error ? error.message : 'parse failed'}`,
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

function booleanValue(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true
}

function arrayLength(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return Array.isArray(value) ? value.length : null
}

function validationBlockers(
  publishPackage: unknown,
  sourceDefinitions: unknown,
  approval: unknown,
): string[] {
  const pkg = asRecord(publishPackage)
  const defs = asRecord(sourceDefinitions)
  const approvalRecord = asRecord(approval)
  const packageValidation = asRecord(pkg.validation_snapshot)
  const definitionValidation = asRecord(defs.validation_report)
  const blockers: string[] = []

  if (!stringValue(pkg, 'package_id')) blockers.push('Publish package is missing package_id.')
  if (!booleanValue(pkg, 'publish_ready')) blockers.push('Publish package is not publish_ready=true.')
  if (stringValue(approvalRecord, 'decision') !== 'approved') blockers.push('Approval decision is not approved.')
  if (!booleanValue(approvalRecord, 'publish_eligible')) blockers.push('Approval is not publish_eligible=true.')
  if (arrayLength(packageValidation, 'errors') !== 0) blockers.push('Publish package validation_snapshot.errors is not empty.')
  if (arrayLength(definitionValidation, 'errors') !== 0) blockers.push('Source definitions validation_report.errors is not empty.')
  if (definitionValidation.passed !== true) blockers.push('Source definitions validation_report.passed is not true.')

  const validationStatus =
    stringValue(definitionValidation, 'validation_status') ||
    stringValue(packageValidation, 'validation_status')
  if (validationStatus !== 'valid' && validationStatus !== 'warning') {
    blockers.push(`Validation status must be valid or warning, currently ${validationStatus || 'missing'}.`)
  }

  for (const key of ['graph_id', 'input_hash', 'compiler_output_id']) {
    if (stringValue(pkg, key) !== stringValue(defs, key)) {
      blockers.push(`Package ${key} does not match source definitions ${key}.`)
    }
  }

  if (
    stringValue(pkg, 'source_definitions_hash') &&
    stringValue(approvalRecord, 'source_definitions_hash') &&
    stringValue(pkg, 'source_definitions_hash') !== stringValue(approvalRecord, 'source_definitions_hash')
  ) {
    blockers.push('Package source_definitions_hash does not match approval.')
  }
  if (
    stringValue(pkg, 'preview_hash') &&
    stringValue(approvalRecord, 'preview_hash') &&
    stringValue(pkg, 'preview_hash') !== stringValue(approvalRecord, 'preview_hash')
  ) {
    blockers.push('Package preview_hash does not match approval.')
  }

  return blockers
}

function redirectPublishResult(
  studyId: string,
  status: 'saved' | 'error',
  reason?: string,
  target: 'source-publish' | 'source-bindings' = 'source-publish',
): never {
  const params = new URLSearchParams({ tab: 'overview', publish: status })
  if (reason) params.set('publishReason', reason.slice(0, 500))
  redirect(`/studies/${studyId}?${params.toString()}#${target}`)
}

export async function publishSourcePackageFromArtifacts(formData: FormData): Promise<void> {
  const organizationId = formText(formData, 'organizationId')
  const studyId = formText(formData, 'studyId')
  const studyVersionId = formText(formData, 'studyVersionId')
  const publishPackageResult = parseJsonField(formData, 'publishPackageJson')
  const sourceDefinitionsResult = parseJsonField(formData, 'sourceDefinitionsJson')
  const approvalResult = parseJsonField(formData, 'approvalJson')

  if (!organizationId || !studyId) {
    redirect('/studies')
  }
  if (!studyVersionId) {
    redirectPublishResult(studyId, 'error', 'Choose a study version before publishing.')
  }

  if (!publishPackageResult.ok) redirectPublishResult(studyId, 'error', publishPackageResult.error)
  if (!sourceDefinitionsResult.ok) redirectPublishResult(studyId, 'error', sourceDefinitionsResult.error)
  if (!approvalResult.ok) redirectPublishResult(studyId, 'error', approvalResult.error)

  const access = await requireActiveOrganizationAccess(organizationId)
  if (!access.ok) {
    redirectPublishResult(studyId, 'error', access.message)
  }
  if (!canPublishSource(access.memberships, organizationId)) {
    redirectPublishResult(studyId, 'error', 'Your role cannot publish source packages.')
  }

  const publishPackage = publishPackageResult.value
  const sourceDefinitions = sourceDefinitionsResult.value
  const approval = approvalResult.value
  const blockers = validationBlockers(publishPackage, sourceDefinitions, approval)
  if (blockers.length > 0) {
    redirectPublishResult(studyId, 'error', blockers.join(' '))
  }

  const supabase = await createServerClient()
  const { data: studyVersion, error: studyVersionError } = await supabase
    .from('study_versions')
    .select('id')
    .eq('id', studyVersionId)
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (studyVersionError || !studyVersion) {
    redirectPublishResult(
      studyId,
      'error',
      studyVersionError?.message ?? 'Study version is not available for this study.',
    )
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc('publish_source_package', {
    p_organization_id: organizationId,
    p_study_id: studyId,
    p_study_version_id: studyVersionId,
    p_publish_package: publishPackage,
    p_source_definitions: sourceDefinitions,
    p_approval: approval,
  })

  if (rpcError) {
    redirectPublishResult(studyId, 'error', rpcError.message)
  }

  const summary = asRecord(rpcResult)
  const packageId = stringValue(summary, 'package_id') || stringValue(asRecord(publishPackage), 'package_id')
  const persistedAt = stringValue(summary, 'persisted_at')
  if (!packageId || !persistedAt) {
    redirectPublishResult(studyId, 'error', 'Publish RPC returned without package_id or persisted_at.')
  }

  const { data: persistedPackage, error: packageError } = await supabase
    .from('source_publish_packages')
    .select('id, persisted_at')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('package_id', packageId)
    .not('persisted_at', 'is', null)
    .maybeSingle()

  if (packageError || !persistedPackage) {
    redirectPublishResult(
      studyId,
      'error',
      packageError?.message ?? 'Publish did not create a persisted source_publish_packages row.',
    )
  }

  const { count, error: sdvError } = await supabase
    .from('source_definition_versions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('lifecycle_status', 'published')
    .contains('meta', { package_id: packageId })

  if (sdvError || !count) {
    redirectPublishResult(
      studyId,
      'error',
      sdvError?.message ?? 'Publish did not create published source definition versions available for binding.',
    )
  }

  await ClinicalMutationGateway.emitStudy({
    supabase,
    organizationId,
    studyId,
    actorUserId: access.user.id,
    eventType: OPERATIONAL_EVENT_TYPES.SOURCE_PACKAGE_PUBLISHED,
    payloadSource: 'source-publish',
    mutation: 'source.publish_package',
    details: {
      study_version_id: studyVersionId,
      package_id: packageId,
      persisted_at: persistedAt,
      published_source_definition_version_count: count,
      graph_id: stringValue(asRecord(publishPackage), 'graph_id') || null,
      source_definitions_hash: stringValue(asRecord(publishPackage), 'source_definitions_hash') || null,
    },
  })

  const graphPublish = await publishProtocolGraph({
    supabase,
    organizationId,
    studyId,
    studyVersionId,
    actorUserId: access.user.id,
  })
  if (!graphPublish.ok) {
    console.warn('[source-publish] protocol graph co-publish skipped:', graphPublish.error)
  }

  revalidatePath(`/studies/${studyId}`)
  revalidatePath(`/studies/${studyId}?tab=overview`)
  redirectPublishResult(studyId, 'saved', `Package ${packageId} persisted with ${count} published source definition version(s).`, 'source-bindings')
}
