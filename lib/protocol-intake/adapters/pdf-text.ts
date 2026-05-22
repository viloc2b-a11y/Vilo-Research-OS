/**
 * PDF adapter shell — expects pre-extracted text (no OCR in 12C).
 */
import { adaptPlainTextDocument } from '@/lib/protocol-intake/adapters/plain-text'
import type { NormalizedIntakeCorpus } from '@/lib/protocol-intake/document'
import type { ProtocolIntakeDocument } from '@/lib/protocol-intake/types'

export type PdfPageText = {
  page_number: number
  text: string
  section_reference?: string
}

export function adaptPdfTextSource(input: {
  document_id: string
  file_name: string
  pages: PdfPageText[]
}): NormalizedIntakeCorpus {
  const doc: ProtocolIntakeDocument = {
    document_id: input.document_id,
    file_name: input.file_name,
    mime_type: 'application/pdf',
    adapter_kind: 'pdf_text',
  }
  const chunks = input.pages.map((page) => ({
    chunk_id: `${input.document_id}-p${page.page_number}`,
    file_name: input.file_name,
    page_or_sheet: String(page.page_number),
    section_reference: page.section_reference,
    text: page.text,
  }))
  return {
    documents: [doc],
    chunks,
    full_text: chunks.map((c) => c.text).join('\n\n'),
  }
}

/** Single blob PDF text fallback. */
export function adaptPdfExtractedText(
  document_id: string,
  file_name: string,
  extractedText: string,
): NormalizedIntakeCorpus {
  return adaptPlainTextDocument({
    document_id,
    file_name,
    text: extractedText,
    page_or_sheet: '1',
    section_reference: 'PDF extracted text',
  })
}
