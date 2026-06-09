import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPLIANCE_STORAGE_BUCKET } from '@/lib/document-intake/upload-document-blob'
import { extractTablesFromDocument } from '@/lib/protocol-intake/extractors/document-extraction-adapter'
import { extractProtocolSectionsFromText } from './extract-protocol-sections'
import { storeProtocolSections } from './store-protocol-sections'
import { extractVisitCandidatesFromSections } from './extract-visit-candidates'
import { extractProcedureCandidatesFromSections } from './extract-procedure-candidates'
import {
  mapProtocolRuntimeSectionRow,
  mapProtocolRuntimeVersionRow,
  mapProtocolRuntimeVisitCandidateRow,
  type ExtractProtocolVersionResult,
  type ProtocolRuntimeVersionRow,
} from './protocol-intake-types'

async function loadComplianceDocumentStorageRef(args: {
  supabase: SupabaseClient
  organizationId: string
  sourceDocumentId: string
}) {
  const { data, error } = await args.supabase
    .from('compliance_runtime_documents')
    .select('id, organization_id, storage_bucket, storage_path, mime_type, original_filename')
    .eq('id', args.sourceDocumentId)
    .eq('organization_id', args.organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Source document not found for this organization.')

  return {
    id: String(data.id),
    bucket: String(data.storage_bucket),
    path: String(data.storage_path),
    mimeType: String(data.mime_type),
    filename: String(data.original_filename),
  }
}

async function bestEffortExtractText(args: {
  supabase: SupabaseClient
  bucket: string
  path: string
  mimeType: string
  filename: string
}): Promise<{ ok: boolean; text: string; note?: string }> {
  const isTextLike =
    args.mimeType.startsWith('text/') ||
    args.filename.toLowerCase().endsWith('.txt') ||
    args.filename.toLowerCase().endsWith('.md')

  if (!isTextLike) {
    return {
      ok: false,
      text: '',
      note: `Unsupported mime for lightweight extraction: ${args.mimeType}`,
    }
  }

  const { data, error } = await args.supabase.storage.from(args.bucket).download(args.path)
  if (error || !data) {
    throw new Error(`Failed to download source document: ${error?.message ?? 'Unknown error'}`)
  }

  const arrayBuffer = await data.arrayBuffer()
  const text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer)
  return { ok: true, text }
}

type ExtractionProvenance = {
  extraction_method: string
  source_table: string
  source_page: number | null
  confidence: number | null
}

type RichExtractResult =
  | {
      ok: true
      text: string
      method: string
      pageCount: number | null
      tables: Array<{ markdown: string; page_no: number | null }>
      provenance: ExtractionProvenance[]
    }
  | { ok: false; note: string }

async function richExtractDocument(args: {
  supabase: SupabaseClient
  bucket: string
  path: string
  mimeType: string
  filename: string
}): Promise<RichExtractResult> {
  const lower = args.filename.toLowerCase()
  const mime = args.mimeType.toLowerCase()
  const isRich =
    ['.pdf', '.docx', '.xlsx', '.csv'].some((ext) => lower.endsWith(ext)) ||
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('officedocument') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime === 'text/csv'

  if (!isRich) {
    return { ok: false, note: `No rich reader available for ${args.mimeType} (${args.filename})` }
  }

  const { data, error } = await args.supabase.storage.from(args.bucket).download(args.path)
  if (error || !data) {
    return { ok: false, note: `Failed to download source document: ${error?.message ?? 'unknown error'}` }
  }

  const buffer = Buffer.from(await data.arrayBuffer())
  const raw = await extractTablesFromDocument(buffer, args.filename)
  if (raw.error) {
    return { ok: false, note: `Reader error: ${raw.error}` }
  }

  const tables = raw.tables ?? []
  const tableText = tables
    .map(
      (table, index) =>
        `\n\n[Table ${index + 1}${table.page_no != null ? ` · p.${table.page_no}` : ''}]\n${table.table_markdown ?? ''}`,
    )
    .join('')
  const text = `${raw.full_text ?? ''}${tableText}`.trim()

  if (text.length === 0) {
    return { ok: false, note: 'Reader returned no extractable text.' }
  }

  return {
    ok: true,
    text,
    method: raw.extraction_method ?? 'docling',
    pageCount: raw.page_count ?? null,
    tables: tables.map((table) => ({
      markdown: (table.table_markdown ?? '').slice(0, 4000),
      page_no: table.page_no ?? null,
    })),
    provenance: tables.map((table, index) => ({
      extraction_method: raw.extraction_method ?? 'docling',
      source_table: `Table ${index + 1}`,
      source_page: table.page_no ?? null,
      confidence: null,
    })),
  }
}

export async function extractProtocolVersion(args: {
  supabase: SupabaseClient
  organizationId: string
  versionId: string
  actorId: string
}): Promise<ExtractProtocolVersionResult> {
  const now = new Date().toISOString()

  const { data: versionRow, error: versionError } = await args.supabase
    .from('protocol_runtime_versions')
    .select('*')
    .eq('id', args.versionId)
    .maybeSingle()

  if (versionError) throw new Error(versionError.message)
  if (!versionRow) throw new Error('Protocol version not found.')

  const { data: parent, error: parentError } = await args.supabase
    .from('protocol_runtime_studies')
    .select('id, organization_id, study_id')
    .eq('id', String(versionRow.protocol_runtime_study_id))
    .maybeSingle()

  if (parentError) throw new Error(parentError.message)
  if (!parent || String(parent.organization_id) !== args.organizationId) {
    throw new Error('Protocol version not found for this organization.')
  }

  await args.supabase
    .from('protocol_runtime_versions')
    .update({ extraction_status: 'extracting', extraction_metadata: { started_at: now } })
    .eq('id', args.versionId)

  const doc = await loadComplianceDocumentStorageRef({
    supabase: args.supabase,
    organizationId: args.organizationId,
    sourceDocumentId: String(versionRow.source_document_id),
  })

  let extractionStatus: ProtocolRuntimeVersionRow['extractionStatus'] = 'review_required'
  let rawText: Record<string, unknown> = {
    source_document: {
      bucket: doc.bucket,
      path: doc.path,
      mime_type: doc.mimeType,
      filename: doc.filename,
    },
    extraction_note: 'Text extraction not available for this document type.',
  }
  let extractedText = `Protocol extraction requires review. (${doc.filename})`
  let extractionMethod = 'unsupported'
  let pageCount: number | null = null
  let provenance: ExtractionProvenance[] = []
  let sectionCount = 0
  let visitCandidateCount = 0
  let procedureCandidateCount = 0
  let attemptedReader: string | null = null
  let failureStage: string | null = null
  let failureMessage: string | null = null

  try {
    const textResult = await bestEffortExtractText({
      supabase: args.supabase,
      bucket: doc.bucket || COMPLIANCE_STORAGE_BUCKET,
      path: doc.path,
      mimeType: doc.mimeType,
      filename: doc.filename,
    }).catch((err) => {
      return { ok: false, text: '', note: err instanceof Error ? err.message : 'Download failed' }
    })

    if (textResult.ok) {
      extractionStatus = 'ready'
      extractedText = textResult.text
      extractionMethod = 'text'
      attemptedReader = 'text'
      rawText = {
        source: 'text',
        text: extractedText.slice(0, 200000),
        extraction_method: 'text',
        attempted_reader: 'text',
        source_document: {
          id: doc.id,
          bucket: doc.bucket,
          path: doc.path,
          mime_type: doc.mimeType,
          filename: doc.filename,
        },
      }
    } else {
      const rich = await richExtractDocument({
        supabase: args.supabase,
        bucket: doc.bucket || COMPLIANCE_STORAGE_BUCKET,
        path: doc.path,
        mimeType: doc.mimeType,
        filename: doc.filename,
      }).catch((err) => ({
        ok: false as const,
        note: err instanceof Error ? err.message : 'Rich extraction failed',
      }))

      if (rich.ok) {
        extractionStatus = 'ready'
        extractedText = rich.text
        extractionMethod = rich.method
        attemptedReader = rich.method
        pageCount = rich.pageCount
        provenance = rich.provenance
        rawText = {
          source: rich.method,
          text: extractedText.slice(0, 200000),
          extraction_method: rich.method,
          attempted_reader: rich.method,
          attempted_readers: [rich.method],
          page_count: pageCount,
          tables: rich.tables,
          source_document: {
            id: doc.id,
            bucket: doc.bucket,
            path: doc.path,
            mime_type: doc.mimeType,
            filename: doc.filename,
          },
        }
      } else {
        failureStage = 'reader'
        failureMessage = rich.note ?? textResult.note ?? 'Rich extraction failed'
        extractionStatus = failureMessage.toLowerCase().includes('unsupported') ? 'review_required' : 'failed'
        attemptedReader = 'docling'
        rawText = {
          ...rawText,
          extraction_note: failureMessage,
          attempted_reader: attemptedReader,
          failure_stage: failureStage,
          error_message: failureMessage,
        }
      }
    }

    const extractedSections = extractProtocolSectionsFromText(extractedText)
    await Promise.all([
      args.supabase.from('protocol_runtime_sections').delete().eq('protocol_version_id', args.versionId),
      args.supabase.from('protocol_runtime_visit_candidates').delete().eq('protocol_version_id', args.versionId),
      args.supabase
        .from('protocol_runtime_procedure_candidates')
        .delete()
        .eq('protocol_version_id', args.versionId),
    ])

    sectionCount = await storeProtocolSections(args.supabase, args.versionId, extractedSections)

    const { data: storedSectionRows, error: storedSectionErr } = await args.supabase
      .from('protocol_runtime_sections')
      .select('*')
      .eq('protocol_version_id', args.versionId)
      .order('sequence_order', { ascending: true })

    if (storedSectionErr) throw new Error(storedSectionErr.message)
    const sections = (storedSectionRows ?? []).map((row) =>
      mapProtocolRuntimeSectionRow(row as Record<string, unknown>),
    )

    const visitCandidates = extractVisitCandidatesFromSections(sections)
    if (visitCandidates.length > 0) {
      const { error } = await args.supabase.from('protocol_runtime_visit_candidates').insert(
        visitCandidates.map((visit) => ({
          protocol_version_id: args.versionId,
          visit_code: visit.visit_code,
          visit_name: visit.visit_name,
          visit_type: visit.visit_type,
          study_day: visit.study_day,
          window_before_days: visit.window_before_days,
          window_after_days: visit.window_after_days,
          extracted_from_section_id: visit.extracted_from_section_id,
          confidence_score: visit.confidence_score,
          reconciliation_status: 'unreviewed',
          metadata: visit.metadata ?? {},
        })),
      )
      if (error) throw new Error(error.message)
      visitCandidateCount = visitCandidates.length
    }

    const { data: visitRows, error: visitErr } = await args.supabase
      .from('protocol_runtime_visit_candidates')
      .select('*')
      .eq('protocol_version_id', args.versionId)

    if (visitErr) throw new Error(visitErr.message)
    const storedVisits = (visitRows ?? []).map((row) =>
      mapProtocolRuntimeVisitCandidateRow(row as Record<string, unknown>),
    )

    const procedureCandidates = extractProcedureCandidatesFromSections({
      sections,
      visits: storedVisits,
    })

    if (procedureCandidates.length > 0) {
      const { error } = await args.supabase.from('protocol_runtime_procedure_candidates').insert(
        procedureCandidates.map((proc) => ({
          protocol_version_id: args.versionId,
          visit_candidate_id: proc.visit_candidate_id,
          procedure_name: proc.procedure_name,
          procedure_category: proc.procedure_category,
          extracted_text: proc.extracted_text,
          confidence_score: proc.confidence_score,
          matched_procedure_library_id: null,
          matched_blueprint_version_id: null,
          reconciliation_status: 'unreviewed',
          metadata: proc.metadata ?? {},
        })),
      )
      if (error) throw new Error(error.message)
      procedureCandidateCount = procedureCandidates.length
    }

    const { data: updated, error: updateErr } = await args.supabase
      .from('protocol_runtime_versions')
      .update({
        raw_text: rawText,
        extraction_status: extractionStatus,
        extraction_metadata: {
          finished_at: now,
          section_count: sectionCount,
          visit_candidate_count: visitCandidateCount,
          procedure_candidate_count: procedureCandidateCount,
          extraction_method: extractionMethod,
          attempted_reader: attemptedReader,
          page_count: pageCount,
          source_table_count: provenance.length,
          provenance,
        },
      })
      .eq('id', args.versionId)
      .select('*')
      .single()

    if (updateErr || !updated) {
      throw new Error(`Failed to update protocol version extraction status: ${updateErr?.message ?? 'Unknown error'}`)
    }

    return {
      version: mapProtocolRuntimeVersionRow(updated as Record<string, unknown>),
      sectionCount,
      visitCandidateCount,
      procedureCandidateCount,
    }
  } catch (error) {
    failureStage = failureStage ?? 'pipeline'
    failureMessage = failureMessage ?? (error instanceof Error ? error.message : 'Unknown extraction error')
    const failureStatus: ProtocolRuntimeVersionRow['extractionStatus'] =
      failureMessage.toLowerCase().includes('unsupported') ? 'review_required' : 'failed'

    const failureRawText = {
      ...rawText,
      attempted_reader: attemptedReader ?? 'unknown',
      failure_stage: failureStage,
      error_message: failureMessage,
      partial_text: extractedText.slice(0, 200000),
    }

    await args.supabase
      .from('protocol_runtime_versions')
      .update({
        raw_text: failureRawText,
        extraction_status: failureStatus,
        extraction_metadata: {
          finished_at: now,
          failed_at: new Date().toISOString(),
          section_count: sectionCount,
          visit_candidate_count: visitCandidateCount,
          procedure_candidate_count: procedureCandidateCount,
          attempted_reader: attemptedReader,
          failure_stage: failureStage,
          error_message: failureMessage,
          extraction_method: extractionMethod,
          page_count: pageCount,
          source_table_count: provenance.length,
          provenance,
        },
      })
      .eq('id', args.versionId)

    throw error instanceof Error ? error : new Error(failureMessage)
  }
}
