/**
 * Excel/CSV schedule adapter — structured rows for visit/procedure extraction.
 */
import type { NormalizedIntakeCorpus } from '@/lib/protocol-intake/document'
import type { ProtocolIntakeDocument } from '@/lib/protocol-intake/types'

export type SpreadsheetRow = Record<string, string>

export function adaptSpreadsheetSource(input: {
  document_id: string
  file_name: string
  sheet_name: string
  headers: string[]
  rows: SpreadsheetRow[]
}): NormalizedIntakeCorpus {
  const doc: ProtocolIntakeDocument = {
    document_id: input.document_id,
    file_name: input.file_name,
    mime_type: input.file_name.endsWith('.csv') ? 'text/csv' : 'application/vnd.ms-excel',
    adapter_kind: 'spreadsheet',
  }
  const headerLine = input.headers.join('\t')
  const body = input.rows
    .map((row) => input.headers.map((h) => row[h] ?? '').join('\t'))
    .join('\n')
  const text = `Sheet: ${input.sheet_name}\n${headerLine}\n${body}`
  const chunks = [
    {
      chunk_id: `${input.document_id}-${input.sheet_name}`,
      file_name: input.file_name,
      page_or_sheet: input.sheet_name,
      section_reference: 'Schedule of Events',
      text,
    },
  ]
  return { documents: [doc], chunks, full_text: text }
}
