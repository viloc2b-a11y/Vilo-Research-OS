/**
 * Phase 12C — protocol intake smoke tests.
 * Run: npx tsx scripts/phase12c-intake-smoke.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { adaptPdfExtractedText, adaptSpreadsheetSource } from '@/lib/protocol-intake/adapters'
import { enrichIntakeCorpus } from '@/lib/protocol-intake/normalization/enrich-corpus'
import {
  PROTOCOL_INTAKE_SAFETY,
  runProtocolIntakePipeline,
} from '@/lib/protocol-intake/pipeline'
import { projectRoot } from './lib/env.mjs'

type Gate = { name: string; pass: boolean; detail?: string }

function gate(name: string, pass: boolean, detail?: string): Gate {
  return { name, pass, detail }
}

function hashDraft(json: string) {
  return createHash('sha256').update(json).digest('hex')
}

function loadFixture(name: string) {
  return readFileSync(join(projectRoot, 'fixtures/protocol-intake', name), 'utf8')
}

function main() {
  const gates: Gate[] = []

  gates.push(
    gate('safety flags no auto-publish', PROTOCOL_INTAKE_SAFETY.auto_publish === false),
    gate('safety flags no runtime mutation', PROTOCOL_INTAKE_SAFETY.mutates_runtime === false),
  )

  const paraText = loadFixture('VALIDATION_PROTOCOL_001-protocol-excerpt.txt')
  const paraCorpus = adaptPdfExtractedText('para-doc-1', 'STUDY-ALPHA-001_Protocol.pdf', paraText)
  const paraCsv = loadFixture('VALIDATION_PROTOCOL_001-schedule.csv')
  const paraLines = paraCsv.trim().split('\n')
  const paraHeaders = paraLines[0].split(',')
  const paraRows = paraLines.slice(1).map((line) => {
    const cols = line.split(',')
    return Object.fromEntries(paraHeaders.map((h, i) => [h, cols[i] ?? '']))
  })
  const paraSheet = adaptSpreadsheetSource({
    document_id: 'para-soe-1',
    file_name: 'PARA_Schedule.csv',
    sheet_name: 'SOE',
    headers: paraHeaders,
    rows: paraRows,
  })
  paraCorpus.chunks.push(...paraSheet.chunks)
  paraCorpus.documents.push(...paraSheet.documents)
  paraCorpus.full_text = paraCorpus.chunks.map((c) => c.text).join('\n\n')

  const frozenAt = '2026-05-22T12:00:00.000Z'
  const para1 = runProtocolIntakePipeline({
    protocol_id: 'STUDY-ALPHA-001',
    protocol_id_hint: 'STUDY-ALPHA-001',
    corpus: paraCorpus,
    created_at: frozenAt,
  })
  const para2 = runProtocolIntakePipeline({
    protocol_id: 'STUDY-ALPHA-001',
    corpus: paraCorpus,
    created_at: frozenAt,
  })

  const meta = para1.draft.study_metadata
  let serializes = false
  try {
    JSON.parse(para1.json)
    serializes = true
  } catch {
    serializes = false
  }
  const enriched = enrichIntakeCorpus(paraCorpus)
  gates.push(
    gate('draft version 12C.2.0', para1.draft.draft_version === '12C.2.0'),
    gate('corpus normalization segments', enriched.segments.length > 0, String(enriched.segments.length)),
    gate('review conflicts array present', Array.isArray(para1.draft.review.conflicts)),
    gate(
      'coordinator JSON hides retrieval machinery',
      !/embedding|chunk_id|fingerprint|raw_prompt/i.test(para1.json),
    ),
    gate(
      'reviewer_required on metadata fields',
      para1.draft.study_metadata.protocol_number.reviewer_required ===
        para1.draft.study_metadata.protocol_number.requires_human_review,
    ),
    gate('draft JSON serializes', serializes),
    gate('PARA protocol number', meta.protocol_number.value === 'VALIDATION_PROTOCOL_001'),
    gate('PARA title present', Boolean(meta.protocol_title.value)),
    gate('PARA sponsor present', Boolean(meta.sponsor.value)),
    gate('PARA phase present', Boolean(meta.phase.value)),
    gate('PARA IP present', Boolean(meta.investigational_product.value)),
    gate('PARA visits candidates', para1.draft.schedule.visits.length >= 3, String(para1.draft.schedule.visits.length)),
    gate('PARA procedures candidates', para1.draft.procedures.length >= 5, String(para1.draft.procedures.length)),
    gate(
      'PARA conditional ACTH/HIT/adrenal',
      para1.draft.procedures.some((p) => /ACTH|HIT|adrenal/i.test(p.procedure_name.value)),
    ),
    gate(
      'PARA recommends canonical libraries',
      para1.draft.source_composition.some((r) => r.recommended_library_blocks.includes('VITALS_CORE_V1')),
    ),
    gate(
      'PARA recommends overlays',
      para1.draft.source_composition.some(
        (r) =>
          r.recommended_overlays.includes('PARA_ADRENAL_OVERLAY_V1')
          || r.recommended_overlays.includes('PARA_HIT_OVERLAY_V1'),
      ),
    ),
    gate(
      'deterministic PARA hash',
      hashDraft(para1.json) === hashDraft(para2.json),
      hashDraft(para1.json).slice(0, 12),
    ),
  )

  const mvText = loadFixture('VALIDATION_PROTOCOL_002-protocol-excerpt.txt')
  const mvCorpus = adaptPdfExtractedText('mv-doc-1', 'VALIDATION_PROTOCOL_002_Protocol.pdf', mvText)
  const mv1 = runProtocolIntakePipeline({ protocol_id: 'VALIDATION_PROTOCOL_002', corpus: mvCorpus })

  gates.push(
    gate('MV protocol number', mv1.draft.study_metadata.protocol_number.value === 'VALIDATION_PROTOCOL_002'),
    gate('MV title present', Boolean(mv1.draft.study_metadata.protocol_title.value)),
    gate(
      'MV index/contact roles in visits',
      mv1.draft.schedule.visits.some((v) =>
        v.eligible_subject_roles.value?.includes('index_patient'),
      )
      || mv1.draft.schedule.visits.some((v) =>
        v.eligible_subject_roles.value?.includes('household_contact'),
      )
      || mv1.draft.schedule.visits.some((v) => /index|household|home|phone|remote/i.test(v.visit_name.value)),
    ),
    gate(
      'MV modalities home/remote/phone',
      mv1.draft.schedule.visits.some((v) => ['home', 'remote', 'phone', 'off_site'].includes(v.modality.value ?? ''))
        || mv1.draft.schedule.visits.some((v) => /home|remote|phone|off/i.test(v.visit_name.value)),
    ),
    gate(
      'MV sick visit candidate',
      mv1.draft.procedures.some((p) => /sick|unscheduled/i.test(p.procedure_name.value))
        || mv1.draft.schedule.visits.some((v) => /sick/i.test(v.visit_name.value)),
    ),
    gate(
      'MV recommends household overlay',
      mv1.draft.source_composition.some((r) =>
        r.recommended_overlays.includes('MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1'),
      ),
    ),
    gate(
      'MV recommends lab/swab blocks',
      mv1.draft.source_composition.some((r) => r.recommended_library_blocks.includes('LAB_CORE_V1')),
    ),
  )

  const allEvidencePara =
    para1.draft.study_metadata.protocol_number.evidence.length > 0
    && para1.draft.procedures.every((p) => p.source_evidence.length > 0)
    && para1.draft.schedule.visits.every((v) => v.evidence.length > 0)
  const allConfidencePara =
    para1.draft.procedures.every((p) => p.confidence)
    && para1.draft.schedule.visits.every((v) => v.confidence)

  gates.push(
    gate('PARA evidence refs on items', allEvidencePara),
    gate('PARA confidence on items', allConfidencePara),
    gate('markdown summary generated', para1.markdown.includes('Coordinator summary')),
    gate('markdown includes conflicts section', para1.markdown.includes('### Conflicts')),
    gate('review lists populated', para1.draft.review.found.length > 0),
  )

  const pipelineSource = readFileSync(
    join(projectRoot, 'lib/protocol-intake/pipeline.ts'),
    'utf8',
  )
  gates.push(
    gate(
      'pipeline does not import publish',
      !/source-publish|publishSource|procedure_source_bindings/i.test(pipelineSource),
    ),
  )

  const failed = gates.filter((g) => !g.pass)
  console.log(
    JSON.stringify(
      {
        phase: '12C-intake-smoke',
        para: {
          visits: para1.draft.schedule.visits.length,
          procedures: para1.draft.procedures.length,
          composition_recs: para1.draft.source_composition.length,
          review: para1.draft.review,
        },
        mv: {
          visits: mv1.draft.schedule.visits.length,
          procedures: mv1.draft.procedures.length,
          overlays: mv1.draft.source_composition.filter((r) =>
            r.recommended_overlays.includes('MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1'),
          ).length,
        },
        gates,
        summary: { passed: gates.length - failed.length, failed: failed.length },
      },
      null,
      2,
    ),
  )
  process.exit(failed.length > 0 ? 1 : 0)
}

main()
