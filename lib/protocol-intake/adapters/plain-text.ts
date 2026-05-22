import { buildCorpus, type DocumentTextChunk, type NormalizedIntakeCorpus } from '@/lib/protocol-intake/document'
import type { ProtocolIntakeDocument } from '@/lib/protocol-intake/types'

export function adaptPlainTextDocument(input: {
  document_id: string
  file_name: string
  text: string
  page_or_sheet?: string
  section_reference?: string
}): NormalizedIntakeCorpus {
  const doc: ProtocolIntakeDocument = {
    document_id: input.document_id,
    file_name: input.file_name,
    mime_type: 'text/plain',
    adapter_kind: 'plain_text',
  }
  const chunks: DocumentTextChunk[] = [
    {
      chunk_id: `${input.document_id}-1`,
      file_name: input.file_name,
      page_or_sheet: input.page_or_sheet ?? '1',
      section_reference: input.section_reference,
      text: input.text,
    },
  ]
  return buildCorpus([doc], chunks)
}
