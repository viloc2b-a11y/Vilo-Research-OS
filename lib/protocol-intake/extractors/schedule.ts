import { evidenceRef, extracted } from '@/lib/protocol-intake/evidence'
import type { NormalizedIntakeCorpus } from '@/lib/protocol-intake/document'
import type { ExtractedVisit, ExtractedVisitProcedure } from '@/lib/protocol-intake/types'

const VISIT_LINE =
  /^\s*visit\s*(\d+)\s*:\s*(.+?)\s*(?:\(window\s*([^)]+)\))?(?:\s*[—–-]\s*(.+))?$/gim

const MODALITY_WORDS: Record<string, string> = {
  phone: 'phone',
  remote: 'remote',
  home: 'home',
  'off-site': 'off_site',
  offsite: 'off_site',
  site: 'site',
}

function detectModality(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [word, value] of Object.entries(MODALITY_WORDS)) {
    if (lower.includes(word)) return value
  }
  return null
}

function detectRoles(text: string): string[] | null {
  const roles: string[] = []
  if (/index\s*patient|index\s*subject/i.test(text)) roles.push('index_patient')
  if (/household\s*contact/i.test(text)) roles.push('household_contact')
  if (/participant/i.test(text)) roles.push('participant')
  return roles.length ? roles : null
}

function detectArms(text: string): string[] | null {
  const arms: string[] = []
  if (/arm\s*a/i.test(text)) arms.push('Arm A')
  if (/arm\s*b/i.test(text)) arms.push('Arm B')
  return arms.length ? arms : null
}

function slugCode(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32)
}

export function extractScheduleVisits(corpus: NormalizedIntakeCorpus): ExtractedVisit[] {
  const visits: ExtractedVisit[] = []
  const seen = new Set<string>()

  for (const chunk of corpus.chunks) {
    const soe = chunk.text.match(/schedule\s+of\s+events\s*:?\s*([\s\S]*)/i)
    const text = soe?.[1] ?? chunk.text

    let match: RegExpExecArray | null
    const re = new RegExp(VISIT_LINE.source, VISIT_LINE.flags)
    while ((match = re.exec(text)) !== null) {
      const dayRaw = match[1]
      let name = (match[2] ?? '').trim()
      const window = (match[3] ?? '').trim()
      const trailing = (match[4] ?? '').trim()
      name = name.replace(/\s*day\s*\d+\s*$/i, '').trim()
      if (!name || name.length < 3) continue

      const code = slugCode(name)
      if (seen.has(code)) continue
      seen.add(code)

      const snippet = match[0].trim()
      const ref = evidenceRef({
        file_name: chunk.file_name,
        page_or_sheet: chunk.page_or_sheet,
        section_reference: 'Schedule of Events',
        source_snippet: snippet,
      })

      const modality = detectModality(`${name} ${trailing}`)
      const roles = detectRoles(`${snippet} ${trailing}`)
      const arms = detectArms(`${snippet} ${trailing}`)

      visits.push({
        visit_code: extracted(code, 'medium', [ref]),
        visit_name: extracted(name, 'medium', [ref]),
        study_day: extracted(dayRaw ? Number(dayRaw) : null, dayRaw ? 'medium' : 'low', [ref], {
          requires_human_review: !dayRaw,
        }),
        window: extracted(window || null, window ? 'medium' : 'low', [ref], {
          requires_human_review: !window,
        }),
        modality: extracted(modality, modality ? 'medium' : 'low', [ref], {
          requires_human_review: !modality,
        }),
        eligible_arms: extracted(arms, arms ? 'medium' : 'low', [ref], {
          requires_human_review: !arms,
        }),
        eligible_subject_roles: extracted(roles, roles ? 'medium' : 'low', [ref], {
          requires_human_review: !roles,
        }),
        procedures: [],
        confidence: 'medium',
        requires_human_review: true,
        evidence: [ref],
      })
    }

    // Tab-separated schedule rows (spreadsheet adapter)
    for (const line of text.split('\n')) {
      if (!line.includes('\t')) continue
      const cols = line.split('\t').map((c) => c.trim())
      if (cols.length < 2) continue
      const [visitCol, dayCol, windowCol, modalityCol] = cols
      if (!visitCol || /visit/i.test(visitCol) && visitCol.length < 8) continue
      const code = slugCode(visitCol)
      if (seen.has(code)) continue
      seen.add(code)
      const ref = evidenceRef({
        file_name: chunk.file_name,
        page_or_sheet: chunk.page_or_sheet,
        section_reference: 'Schedule sheet row',
        source_snippet: line,
      })
      visits.push({
        visit_code: extracted(code, 'high', [ref]),
        visit_name: extracted(visitCol, 'high', [ref]),
        study_day: extracted(dayCol ? Number(dayCol) : null, dayCol ? 'high' : 'low', [ref]),
        window: extracted(windowCol || null, windowCol ? 'high' : 'low', [ref]),
        modality: extracted(modalityCol || detectModality(line), 'medium', [ref]),
        eligible_arms: extracted(detectArms(line), 'low', [ref], { requires_human_review: true }),
        eligible_subject_roles: extracted(detectRoles(line), 'low', [ref], {
          requires_human_review: true,
        }),
        procedures: [],
        confidence: 'high',
        requires_human_review: false,
        evidence: [ref],
      })
    }
  }

  return visits
}

export function attachProceduresToVisits(
  visits: ExtractedVisit[],
  procedureLines: Array<{
    visit_hint: string
    procedure_code: string
    procedure_name: string
    required: boolean
    conditional: boolean
    condition_text: string | null
    evidence: ReturnType<typeof evidenceRef>[]
  }>,
): ExtractedVisit[] {
  return visits.map((visit) => {
    const code = visit.visit_code.value
    const name = visit.visit_name.value
    const procs: ExtractedVisitProcedure[] = procedureLines
      .filter(
        (p) =>
          p.visit_hint.toLowerCase() === code.toLowerCase()
          || name.toLowerCase().includes(p.visit_hint.toLowerCase())
          || p.visit_hint.toLowerCase().includes(name.toLowerCase()),
      )
      .map((p) => ({
        procedure_code: extracted(p.procedure_code, 'medium', p.evidence),
        procedure_name: extracted(p.procedure_name, 'medium', p.evidence),
        required: extracted(p.required, 'medium', p.evidence),
        conditional: extracted(p.conditional, 'medium', p.evidence),
        condition_text: extracted(p.condition_text, p.conditional ? 'medium' : 'low', p.evidence, {
          requires_human_review: p.conditional,
        }),
      }))
    return { ...visit, procedures: procs }
  })
}
