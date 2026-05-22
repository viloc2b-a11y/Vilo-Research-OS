/**
 * Word/docx adapter shell — expects pre-extracted text blocks.
 */
import type { NormalizedIntakeCorpus } from '@/lib/protocol-intake/document'
import type { ProtocolIntakeDocument } from '@/lib/protocol-intake/types'

export type DocxSectionText = {
  section_reference: string
  text: string
}

export function adaptDocxTextSource(input: {
  document_id: string
  file_name: string
  sections: DocxSectionText[]
}): NormalizedIntakeCorpus {
  const doc: ProtocolIntakeDocument = {
    document_id: input.document_id,
    file_name: input.file_name,
    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    adapter_kind: 'docx_text',
  }
  const chunks = input.sections.map((section, index) => ({
    chunk_id: `${input.document_id}-s${index + 1}`,
    file_name: input.file_name,
    page_or_sheet: `section-${index + 1}`,
    section_reference: section.section_reference,
    text: section.text,
  }))
  return {
    documents: [doc],
    chunks,
    full_text: chunks.map((c) => c.text).join('\n\n'),
  }
}
