import { evidenceRef, extracted } from '@/lib/protocol-intake/evidence'
import type { NormalizedIntakeCorpus } from '@/lib/protocol-intake/document'
import type { ExtractedProcedure } from '@/lib/protocol-intake/types'

const PROC_LINE =
  /^\s*procedure\s*:\s*(.+?)\s*\((required|optional|conditional)\)(?:\s*[-–]\s*(.+))?$/gim

const CATEGORY_RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /vital|blood pressure|heart rate|temperature|weight|height/i, category: 'vitals' },
  { pattern: /adverse event|\bAE\b/i, category: 'adverse_events' },
  { pattern: /concomitant|conmed|medication/i, category: 'concomitant_medications' },
  { pattern: /IP admin|investigational product|infusion|injection/i, category: 'ip_administration' },
  { pattern: /hematology|chemistry|cortisol|lab|swab|specimen|platelet|PF4|ACTH|HIT/i, category: 'labs' },
  { pattern: /\bECG\b|electrocardiogram/i, category: 'ecg' },
  { pattern: /physical exam|adrenal|symptom/i, category: 'physical_exam' },
]

function categorize(name: string): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) return rule.category
  }
  return 'general'
}

function slugProcedure(name: string) {
  return `PROC_${name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)}`
}

export function extractProcedures(corpus: NormalizedIntakeCorpus): {
  procedures: ExtractedProcedure[]
  visitLinks: Array<{
    visit_hint: string
    procedure_code: string
    procedure_name: string
    required: boolean
    conditional: boolean
    condition_text: string | null
    evidence: ReturnType<typeof evidenceRef>[]
  }>
} {
  const procedures: ExtractedProcedure[] = []
  const visitLinks: Array<{
    visit_hint: string
    procedure_code: string
    procedure_name: string
    required: boolean
    conditional: boolean
    condition_text: string | null
    evidence: ReturnType<typeof evidenceRef>[]
  }> = []
  const seen = new Set<string>()

  for (const chunk of corpus.chunks) {
    const block = chunk.text.match(/study\s+procedures\s*:?\s*([\s\S]*)/i)?.[1] ?? chunk.text
    let match: RegExpExecArray | null
    const re = new RegExp(PROC_LINE.source, PROC_LINE.flags)
    while ((match = re.exec(block)) !== null) {
      const name = (match[1] ?? '').trim()
      if (name.length < 3) continue
      const flag = (match[2] ?? 'required').toLowerCase()
      const notes = (match[3] ?? '').trim()
      const code = slugProcedure(name)
      if (seen.has(code)) continue
      seen.add(code)

      const conditional = flag === 'conditional' || /if indicated|when clinically/i.test(notes)
      const ref = evidenceRef({
        file_name: chunk.file_name,
        page_or_sheet: chunk.page_or_sheet,
        section_reference: 'Study Procedures',
        source_snippet: match[0].trim(),
      })

      const visitHintMatch = notes.match(/visit\s*:\s*([A-Za-z0-9 /\-]+)/i)
      if (visitHintMatch) {
        visitLinks.push({
          visit_hint: visitHintMatch[1].trim(),
          procedure_code: code,
          procedure_name: name,
          required: flag === 'required',
          conditional,
          condition_text: conditional ? notes || null : null,
          evidence: [ref],
        })
      }

      procedures.push({
        procedure_code: extracted(code, 'medium', [ref]),
        procedure_name: extracted(name, 'medium', [ref]),
        procedure_category: extracted(categorize(name), 'medium', [ref]),
        required: extracted(flag === 'required', 'medium', [ref]),
        conditional: extracted(conditional, conditional ? 'medium' : 'high', [ref]),
        condition_text: extracted(conditional ? notes || null : null, conditional ? 'medium' : 'low', [ref], {
          requires_human_review: conditional,
        }),
        timing_notes: extracted(notes || null, notes ? 'low' : 'low', [ref], {
          requires_human_review: true,
        }),
        source_evidence: [ref],
        confidence: conditional ? 'medium' : 'medium',
        requires_human_review: conditional || flag !== 'required',
      })
    }

    // Explicit conditional procedure phrases (PARA ACTH/HIT)
    const conditionalPhrases = [
      { pattern: /ACTH\s*stimulation/i, name: 'ACTH Stimulation Test', category: 'labs' },
      { pattern: /HIT|anti[- ]?PF4|platelet\s*drop/i, name: 'HIT / Platelet Panel', category: 'labs' },
      { pattern: /adrenal\s+(?:insufficiency\s+)?symptom/i, name: 'Adrenal Symptom Review', category: 'physical_exam' },
      { pattern: /nasal\s*swab|home\s*swab/i, name: 'Home Nasal Swab', category: 'labs' },
      { pattern: /sick\s*visit|unscheduled/i, name: 'Unscheduled Sick Assessment', category: 'symptoms' },
    ]
    for (const item of conditionalPhrases) {
      if (!item.pattern.test(chunk.text)) continue
      const m = chunk.text.match(item.pattern)
      const code = slugProcedure(item.name)
      if (seen.has(code)) continue
      seen.add(code)
      const ref = evidenceRef({
        file_name: chunk.file_name,
        page_or_sheet: chunk.page_or_sheet,
        section_reference: 'Conditional procedures',
        source_snippet: m?.[0] ?? item.name,
      })
      procedures.push({
        procedure_code: extracted(code, 'medium', [ref]),
        procedure_name: extracted(item.name, 'medium', [ref]),
        procedure_category: extracted(item.category, 'medium', [ref]),
        required: extracted(false, 'high', [ref]),
        conditional: extracted(true, 'high', [ref]),
        condition_text: extracted(m?.[0] ?? null, 'medium', [ref], { requires_human_review: true }),
        timing_notes: extracted(null, 'low', [ref], { requires_human_review: true }),
        source_evidence: [ref],
        confidence: 'medium',
        requires_human_review: true,
      })
    }
  }

  return { procedures, visitLinks }
}
