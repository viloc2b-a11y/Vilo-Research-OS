import { createOpenRouterChatCompletion } from '@/lib/openrouter/server'
import type { ConfidenceLevel, ScheduleMatrixIntersection, RawExtractionOutput } from '../types'

type ParsedScheduleIntersection = Partial<ScheduleMatrixIntersection>

function asParsedIntersections(value: unknown): ParsedScheduleIntersection[] {
  if (!value || typeof value !== 'object') return []
  const intersections = (value as { intersections?: unknown }).intersections
  return Array.isArray(intersections) ? intersections as ParsedScheduleIntersection[] : []
}

function normalizeConfidence(value: unknown): ConfidenceLevel {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low'
}

export async function extractScheduleMatrix(
  rawResult: RawExtractionOutput,
  studyId: string,
  protocolDocumentId: string,
): Promise<{ ok: boolean; data?: ScheduleMatrixIntersection[]; error?: string }> {
  // Combine tables into a prompt payload (limit to first 5 tables if there are many to avoid context limits, usually SOA is big though)
  const tablesHtml = (rawResult.tables || [])
    .map((table, i) => `Table ${i + 1}:\n${table.table_html}`)
    .join('\n\n')

  // Step 2: Semantic Normalization via LLM
  const prompt = `
You are a clinical protocol parser.
Below are extracted HTML tables from a Schedule of Events (SoE) document.
Your task is to map these tables into a strict JSON array of procedure/visit intersections.
DO NOT INVENT ROWS OR VISITS. Extract exactly what is in the tables.
False positives are acceptable, but do not miss any procedure rows.

Rules:
- If a cell contains 'X' or 'x', required_status = true, conditionality = false.
- If a cell contains '(X)', '(x)', 'O', or refers to a footnote making it optional/conditional, required_status = false, conditionality = true.
- Extract any footnotes attached to the procedure or cell into 'source_note'.
- visit_phase should be 'screening', 'treatment', 'follow-up', 'eos', or 'other' based on the column grouping.

Output JSON format exactly as follows:
{
  "intersections": [
    {
      "visit_name": "Screening",
      "visit_number": 1,
      "study_day": -14,
      "visit_window": "+/- 2 days",
      "visit_phase": "screening",
      "procedure_name": "Vital Signs",
      "procedure_category": "Clinical",
      "required_status": true,
      "conditionality": false,
      "source_note": "Includes Temp, HR, BP",
      "protocol_reference": "Table 1",
      "confidence_score": "high", // 'high', 'medium', or 'low'
      "needs_review": false, // true if uncertain or if it's conditional
      "suggested_downstream_consumer": "vitals"
    }
  ]
}

Tables:
${tablesHtml}
  `

  try {
    const aiResponse = await createOpenRouterChatCompletion({
      model: 'openai/gpt-4o',
      messages: [
        { role: 'system', content: 'You are a strict JSON outputting data parser.' },
        { role: 'user', content: prompt }
      ]
    })

    const content = aiResponse.choices?.[0]?.message?.content || ''
    
    // Extract JSON block
    const jsonMatch = content.match(/```json\n([\s\S]*)\n```/) || content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { ok: false, error: 'LLM failed to return valid JSON.' }
    }

    const parsed: unknown = JSON.parse(jsonMatch[1] || jsonMatch[0])
    
    const extractionRunId = crypto.randomUUID()
    
    // Append standard IDs
    const normalizedData: ScheduleMatrixIntersection[] = asParsedIntersections(parsed).map((item) => {
      const confidenceScore = normalizeConfidence(item.confidence_score)
      const conditionality = Boolean(item.conditionality)
      return {
        study_id: studyId,
        protocol_document_id: protocolDocumentId,
        extraction_run_id: extractionRunId,
        visit_name: item.visit_name || 'Unknown',
        visit_number: item.visit_number ?? null,
        study_day: item.study_day ?? null,
        visit_window: item.visit_window ?? null,
        visit_phase: item.visit_phase ?? 'other',
        procedure_name: item.procedure_name || 'Unknown',
        procedure_category: item.procedure_category || 'Uncategorized',
        required_status: Boolean(item.required_status),
        conditionality,
        source_note: item.source_note ?? null,
        protocol_reference: item.protocol_reference || 'Schedule of Events',
        confidence_score: confidenceScore,
        needs_review: Boolean(item.needs_review) || conditionality || confidenceScore === 'low',
        suggested_downstream_consumer: item.suggested_downstream_consumer ?? null,
      }
    })

    return { ok: true, data: normalizedData }
  } catch (err) {
    console.error('Schedule normalization error:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Normalization failed' }
  }
}
