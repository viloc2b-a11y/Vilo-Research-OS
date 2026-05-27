import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { EXTRACTION_STATUS } from './document-intelligence-types'

export type ComplianceDocumentSource = {
  id: string
  organizationId: string
  studyId: string | null
  documentClassification: string
  originalFilename: string
  mimeType: string
  storageBucket: string
  storagePath: string
}

export type ExtractTextResult =
  | { ok: true; text: string; mimeType: string }
  | { ok: false; extractionStatus: typeof EXTRACTION_STATUS.UNSUPPORTED | typeof EXTRACTION_STATUS.FAILED; message: string }

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/json',
])

function isTextLikeMime(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase()
  return TEXT_MIME_TYPES.has(normalized) || normalized.startsWith('text/')
}

export async function loadComplianceDocumentSource(
  supabase: SupabaseClient,
  organizationId: string,
  complianceDocumentId: string,
): Promise<ComplianceDocumentSource | null> {
  const { data, error } = await supabase
    .from('compliance_runtime_documents')
    .select(
      'id, organization_id, study_id, document_classification, original_filename, mime_type, storage_bucket, storage_path',
    )
    .eq('id', complianceDocumentId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    id: String(data.id),
    organizationId: String(data.organization_id),
    studyId: data.study_id ? String(data.study_id) : null,
    documentClassification: String(data.document_classification),
    originalFilename: String(data.original_filename),
    mimeType: String(data.mime_type),
    storageBucket: String(data.storage_bucket),
    storagePath: String(data.storage_path),
  }
}

export async function extractTextFromComplianceDocument(
  supabase: SupabaseClient,
  source: ComplianceDocumentSource,
): Promise<ExtractTextResult> {
  const mimeType = source.mimeType.toLowerCase()

  if (mimeType === 'application/pdf' || mimeType.includes('word') || mimeType.includes('officedocument')) {
    return {
      ok: false,
      extractionStatus: EXTRACTION_STATUS.UNSUPPORTED,
      message: `Extraction not supported for ${mimeType}. Upload plain text or markdown for intelligence ingestion.`,
    }
  }

  if (!isTextLikeMime(mimeType)) {
    return {
      ok: false,
      extractionStatus: EXTRACTION_STATUS.UNSUPPORTED,
      message: `Unsupported mime type for K1 extraction: ${mimeType}`,
    }
  }

  let buffer: Buffer
  try {
    buffer = await downloadComplianceDocumentBlob(source)
  } catch (err) {
    return {
      ok: false,
      extractionStatus: EXTRACTION_STATUS.FAILED,
      message: err instanceof Error ? err.message : 'Failed to download document from storage',
    }
  }

  try {
    const text = buffer.toString('utf8').trim()
    if (!text) {
      return {
        ok: false,
        extractionStatus: EXTRACTION_STATUS.FAILED,
        message: 'Document blob is empty after text decode',
      }
    }
    return { ok: true, text, mimeType }
  } catch (err) {
    return {
      ok: false,
      extractionStatus: EXTRACTION_STATUS.FAILED,
      message: err instanceof Error ? err.message : 'Failed to decode document text',
    }
  }
}

export async function downloadComplianceDocumentBlob(
  source: ComplianceDocumentSource,
): Promise<Buffer> {
  const supabaseAdmin = createSupabaseAdmin()
  const { data, error } = await supabaseAdmin.storage
    .from(source.storageBucket)
    .download(source.storagePath)

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to download document from storage')
  }

  return Buffer.from(await data.arrayBuffer())
}
