import type { SupabaseClient } from '@supabase/supabase-js'
import { loadRuntimeSourcePackage } from '@/lib/runtime-source-package/load-runtime-source-package'
import { PACKAGE_STATUS } from '@/lib/runtime-source-package/source-package-types'
import { appendPublicationEvent } from './append-publication-event'
import {
  PLACEHOLDER_SCOPE,
  PLACEHOLDER_STATUS,
  PUBLICATION_EVENT_TYPE,
  SIGNATURE_MEANING,
  mapSignaturePlaceholderRow,
  type RuntimeSourceSignaturePlaceholderRow,
} from './runtime-source-publication-types'

function shouldCreateProcedurePlaceholderFromShell(shell: {
  required: boolean
  sourceShellJson: Record<string, unknown>
  metadata: Record<string, unknown>
}): boolean {
  if (!shell.required) return false
  const json = shell.sourceShellJson ?? {}
  const meta = shell.metadata ?? {}

  const fieldsUnknown = (json as Record<string, unknown>).fields
  const fields = Array.isArray(fieldsUnknown) ? fieldsUnknown : []
  const hasSignatureField = fields.some((f) => {
    if (!f || typeof f !== 'object') return false
    const type = (f as Record<string, unknown>).type
    return String(type) === 'signature'
  })

  const flagged = Boolean((meta as Record<string, unknown>).requires_signature_placeholder)
  return hasSignatureField || flagged
}

export async function createSignaturePlaceholdersFromPackage(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  sourcePackageId: string
  actorId: string
}): Promise<{ created: number; placeholders: RuntimeSourceSignaturePlaceholderRow[] }> {
  // Idempotent: if ANY placeholders exist, we won't generate defaults again.
  const { data: existing, error: existingError } = await args.supabase
    .from('runtime_source_signature_placeholders')
    .select('id')
    .eq('organization_id', args.organizationId)
    .eq('source_package_id', args.sourcePackageId)
    .limit(1)

  if (existingError) throw new Error(existingError.message)
  if ((existing ?? []).length > 0) {
    const { data: rows, error } = await args.supabase
      .from('runtime_source_signature_placeholders')
      .select('*')
      .eq('organization_id', args.organizationId)
      .eq('source_package_id', args.sourcePackageId)
      .order('placeholder_scope', { ascending: true })
      .order('sequence_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return { created: 0, placeholders: (rows ?? []).map((r) => mapSignaturePlaceholderRow(r as Record<string, unknown>)) }
  }

  const loaded = await loadRuntimeSourcePackage(args.supabase, args.organizationId, args.sourcePackageId)
  if (!loaded) throw new Error('Source package not found')
  // Placeholders can exist for drafts too, but default generation is primarily for approved packages.
  // We still generate defaults when publishing to support UI preview.
  const isApproved = loaded.package.packageStatus === PACKAGE_STATUS.APPROVED
  void isApproved

  const inserts: Array<Record<string, unknown>> = []

  // Default 1: package-level PI approved
  inserts.push({
    organization_id: args.organizationId,
    study_id: args.studyId,
    source_package_id: args.sourcePackageId,
    visit_shell_id: null,
    procedure_shell_id: null,
    placeholder_scope: PLACEHOLDER_SCOPE.PACKAGE,
    required_role: 'pi',
    signature_meaning: SIGNATURE_MEANING.APPROVED,
    required: true,
    sequence_order: 1,
    display_label: 'PI approval',
    instructions: 'Approve the source package for execution workflows.',
    status: PLACEHOLDER_STATUS.ACTIVE,
    metadata: { generated_default: true },
  })

  // Default 2: visit-level coordinator performed
  for (const visitShell of loaded.visitShells) {
    inserts.push({
      organization_id: args.organizationId,
      study_id: args.studyId,
      source_package_id: args.sourcePackageId,
      visit_shell_id: visitShell.id,
      procedure_shell_id: null,
      placeholder_scope: PLACEHOLDER_SCOPE.VISIT,
      required_role: 'coordinator',
      signature_meaning: SIGNATURE_MEANING.PERFORMED,
      required: true,
      sequence_order: 1,
      display_label: `Visit performed: ${visitShell.visitCode}`,
      instructions: null,
      status: PLACEHOLDER_STATUS.ACTIVE,
      metadata: { generated_default: true },
    })
  }

  // Default 3: procedure-level placeholders when signature-like
  for (const procShell of loaded.procedureShells) {
    if (!shouldCreateProcedurePlaceholderFromShell(procShell)) continue
    inserts.push({
      organization_id: args.organizationId,
      study_id: args.studyId,
      source_package_id: args.sourcePackageId,
      visit_shell_id: procShell.visitShellId,
      procedure_shell_id: procShell.id,
      placeholder_scope: PLACEHOLDER_SCOPE.PROCEDURE,
      required_role: 'coordinator',
      signature_meaning: SIGNATURE_MEANING.VERIFIED,
      required: true,
      sequence_order: 1,
      display_label: `Procedure verified: ${procShell.procedureCode}`,
      instructions: null,
      status: PLACEHOLDER_STATUS.ACTIVE,
      metadata: { generated_default: true },
    })
  }

  const createdPlaceholders: RuntimeSourceSignaturePlaceholderRow[] = []
  let created = 0

  for (const row of inserts) {
    const { data, error } = await args.supabase
      .from('runtime_source_signature_placeholders')
      .insert(row)
      .select('*')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Failed to create signature placeholder')
    created += 1
    const mapped = mapSignaturePlaceholderRow(data as Record<string, unknown>)
    createdPlaceholders.push(mapped)
    await appendPublicationEvent({
      supabase: args.supabase,
      organizationId: args.organizationId,
      studyId: args.studyId,
      sourcePackageId: args.sourcePackageId,
      publicationId: null,
      eventType: PUBLICATION_EVENT_TYPE.SIGNATURE_PLACEHOLDER_CREATED,
      actorId: args.actorId,
      eventPayload: {
        placeholder_id: mapped.id,
        scope: mapped.placeholderScope,
        meaning: mapped.signatureMeaning,
        role: mapped.requiredRole,
      },
      stateSnapshot: { placeholder_id: mapped.id, status: mapped.status },
    })
  }

  return { created, placeholders: createdPlaceholders }
}

