import { evidenceRef, extracted } from '@/lib/protocol-intake/evidence'
import type { NormalizedIntakeCorpus } from '@/lib/protocol-intake/document'
import type { ExtractedStudyMetadata } from '@/lib/protocol-intake/types'

function firstMatch(text: string, pattern: RegExp): { value: string; snippet: string } | null {
  const m = text.match(pattern)
  if (!m?.[0]) return null
  return { value: (m[1] ?? m[0]).trim(), snippet: m[0].trim() }
}

function findInCorpus(corpus: NormalizedIntakeCorpus, pattern: RegExp) {
  for (const chunk of corpus.chunks) {
    const hit = firstMatch(chunk.text, pattern)
    if (hit) {
      return {
        hit,
        ref: evidenceRef({
          file_name: chunk.file_name,
          page_or_sheet: chunk.page_or_sheet,
          section_reference: chunk.section_reference,
          source_snippet: hit.snippet,
        }),
      }
    }
  }
  const hit = firstMatch(corpus.full_text, pattern)
  if (!hit) return null
  return {
    hit,
    ref: evidenceRef({
      file_name: corpus.documents[0]?.file_name ?? 'unknown',
      page_or_sheet: 'corpus',
      source_snippet: hit.snippet,
    }),
  }
}

export function extractStudyMetadata(
  corpus: NormalizedIntakeCorpus,
  protocolIdHint?: string,
): ExtractedStudyMetadata {
  const refs: ReturnType<typeof evidenceRef>[] = []

  const protocolNumber = findInCorpus(
    corpus,
    /protocol\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_]+)/i,
  )
  const title = findInCorpus(corpus, /protocol\s*title\s*[:\-]\s*(.+)/i)
  const brief = findInCorpus(corpus, /brief\s*title\s*[:\-]\s*(.+)/i)
  const sponsor = findInCorpus(corpus, /sponsor\s*[:\-]\s*(.+)/i)
  const cro = findInCorpus(corpus, /CRO\s*[:\-]\s*(.+)/i)
  const phase = findInCorpus(corpus, /phase\s*([12][ab]?|3|4)/i)
  const indication = findInCorpus(corpus, /indication\s*[:\-]\s*(.+)/i)
  const ip = findInCorpus(
    corpus,
    /investigational\s*product\s*[:\-]\s*(.+)/i,
  )
  const design = findInCorpus(
    corpus,
    /study\s*design\s*[:\-]\s*(.+)/i,
  )
  const blinded = findInCorpus(corpus, /(double[- ]blind|open[- ]label|single[- ]blind)/i)
  const enrollment = findInCorpus(corpus, /enrollment\s*(?:target|goal)?\s*[:\-]?\s*(\d+)/i)
  const duration = findInCorpus(corpus, /study\s*duration\s*[:\-]\s*(.+)/i)

  const collect = (r: ReturnType<typeof findInCorpus>) => {
    if (r) refs.push(r.ref)
    return r
  }

  const pn = collect(protocolNumber)
  const t = collect(title)
  const b = collect(brief)
  const sp = collect(sponsor)
  const cr = collect(cro)
  const ph = collect(phase)
  const ind = collect(indication)
  const product = collect(ip)
  const sd = collect(design)
  const bl = collect(blinded)
  const en = collect(enrollment)
  const dur = collect(duration)

  const protocolFromHint =
    protocolIdHint && !pn
      ? extracted(protocolIdHint, 'medium', [
          evidenceRef({
            file_name: corpus.documents[0]?.file_name ?? 'intake',
            page_or_sheet: 'hint',
            source_snippet: `Protocol id hint: ${protocolIdHint}`,
          }),
        ])
      : null

  return {
    protocol_number: pn
      ? extracted(pn.hit.value, 'high', [pn.ref])
      : protocolFromHint ?? extracted(null, 'low', refs, { requires_human_review: true }),
    protocol_title: t
      ? extracted(t.hit.value, 'high', [t.ref])
      : extracted(null, 'low', refs, { requires_human_review: true }),
    brief_title: b
      ? extracted(b.hit.value, 'medium', [b.ref])
      : extracted(null, 'low', [], { requires_human_review: true }),
    sponsor: sp
      ? extracted(sp.hit.value, 'high', [sp.ref])
      : extracted(null, 'low', [], { requires_human_review: true }),
    cro: cr
      ? extracted(cr.hit.value, 'medium', [cr.ref])
      : extracted(null, 'low', [], { requires_human_review: true }),
    phase: ph
      ? extracted(ph.hit.value, 'high', [ph.ref])
      : extracted(null, 'low', [], { requires_human_review: true }),
    indication: ind
      ? extracted(ind.hit.value, 'medium', [ind.ref])
      : extracted(null, 'low', [], { requires_human_review: true }),
    investigational_product: product
      ? extracted(product.hit.value, 'high', [product.ref])
      : extracted(null, 'low', [], { requires_human_review: true }),
    study_design: sd
      ? extracted(sd.hit.value, 'medium', [sd.ref])
      : extracted(null, 'low', [], { requires_human_review: true }),
    blinded_status: bl
      ? extracted(bl.hit.value, 'medium', [bl.ref])
      : extracted(null, 'low', [], { requires_human_review: true }),
    enrollment_target: en
      ? extracted(Number(en.hit.value), 'medium', [en.ref])
      : extracted(null, 'low', [], { requires_human_review: true }),
    study_duration: dur
      ? extracted(dur.hit.value, 'medium', [dur.ref])
      : extracted(null, 'low', [], { requires_human_review: true }),
    source_document_evidence_refs: refs,
  }
}
