import type { SupabaseClient } from '@supabase/supabase-js'
import { assertRuntimeObjectHasNoRawVaultFields } from '@/lib/protocol-vault/runtime-boundary'
import type {
  ProtocolRawDocumentRecord,
  RawDocumentRegistrySummary,
  RawDocumentStatus,
} from '@/lib/protocol-vault/types'
import {
  assertProtocolVaultReadScope,
  type ProtocolVaultReadScope,
} from '@/lib/protocol-vault/vault-scope'

export type RegisterRawDocumentInput = {
  organizationId: string
  studyId?: string | null
  originalFilename: string
  storagePath: string
  checksum: string
  mimeType?: string | null
  status?: RawDocumentStatus
  createdBy?: string | null
}

function toRegistrySummary(row: ProtocolRawDocumentRecord): RawDocumentRegistrySummary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    studyId: row.study_id,
    checksum: row.checksum,
    mimeType: row.mime_type,
    status: row.status,
    createdAt: row.created_at,
  }
}

/**
 * Register a raw protocol document in the vault. Returns a runtime-safe summary only.
 */
export async function registerRawDocument(
  supabase: SupabaseClient,
  input: RegisterRawDocumentInput,
): Promise<RawDocumentRegistrySummary> {
  const { data, error } = await supabase
    .from('protocol_raw_documents')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId ?? null,
      original_filename: input.originalFilename.trim(),
      storage_path: input.storagePath.trim(),
      checksum: input.checksum.trim(),
      mime_type: input.mimeType ?? null,
      status: input.status ?? 'registered',
      created_by: input.createdBy ?? null,
    })
    .select('id, organization_id, study_id, checksum, mime_type, status, created_at')
    .single()

  if (error || !data) {
    throw new Error(`Failed to register raw document: ${error?.message ?? 'unknown error'}`)
  }

  const summary = {
    id: data.id as string,
    organizationId: data.organization_id as string,
    studyId: (data.study_id as string | null) ?? null,
    checksum: data.checksum as string,
    mimeType: (data.mime_type as string | null) ?? null,
    status: data.status as RawDocumentStatus,
    createdAt: data.created_at as string,
  }

  assertRuntimeObjectHasNoRawVaultFields(summary, 'raw document registry summary')
  return summary
}

/**
 * Vault-only read — requires an explicit read scope. Do not call from runtime UI modules.
 */
export async function fetchRawDocumentForVault(
  scope: ProtocolVaultReadScope,
  supabase: SupabaseClient,
  documentId: string,
): Promise<ProtocolRawDocumentRecord | null> {
  assertProtocolVaultReadScope(scope, 'fetchRawDocumentForVault')

  const { data, error } = await supabase
    .from('protocol_raw_documents')
    .select(
      'id, organization_id, study_id, original_filename, storage_path, checksum, mime_type, status, created_by, created_at',
    )
    .eq('id', documentId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch raw document: ${error.message}`)
  }

  return (data as ProtocolRawDocumentRecord | null) ?? null
}

/**
 * Extract vault-only fields for intake / de-identification pipelines.
 */
export function readRawDocumentVaultFields(
  scope: ProtocolVaultReadScope,
  record: ProtocolRawDocumentRecord,
): Pick<ProtocolRawDocumentRecord, 'original_filename' | 'storage_path' | 'checksum'> {
  assertProtocolVaultReadScope(scope, 'readRawDocumentVaultFields')
  return {
    original_filename: record.original_filename,
    storage_path: record.storage_path,
    checksum: record.checksum,
  }
}

export function toRawDocumentRegistrySummary(
  record: ProtocolRawDocumentRecord,
): RawDocumentRegistrySummary {
  return toRegistrySummary(record)
}
