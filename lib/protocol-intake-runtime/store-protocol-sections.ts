import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedSection } from './extract-protocol-sections'

export async function storeProtocolSections(
  supabase: SupabaseClient,
  protocolVersionId: string,
  sections: ExtractedSection[],
): Promise<number> {
  if (sections.length === 0) return 0

  const { error } = await supabase.from('protocol_runtime_sections').insert(
    sections.map((section) => ({
      protocol_version_id: protocolVersionId,
      section_code: section.section_code,
      section_title: section.section_title,
      section_type: section.section_type,
      sequence_order: section.sequence_order,
      extracted_text: section.extracted_text,
      extraction_confidence: section.extraction_confidence,
      requires_review: section.requires_review,
      metadata: section.metadata ?? {},
    })),
  )

  if (error) throw new Error(error.message)
  return sections.length
}

