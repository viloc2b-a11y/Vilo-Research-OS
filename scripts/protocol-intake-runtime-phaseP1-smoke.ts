/**
 * Phase P1 smoke: protocol intake runtime foundation.
 *
 * Usage:
 *   npx tsx scripts/protocol-intake-runtime-phaseP1-smoke.ts
 *   npx tsx scripts/protocol-intake-runtime-phaseP1-smoke.ts --live
 */
import { createClient } from '@supabase/supabase-js'
import { extractProtocolSectionsFromText } from '../lib/protocol-intake-runtime/extract-protocol-sections'
import { extractVisitCandidatesFromSections } from '../lib/protocol-intake-runtime/extract-visit-candidates'
import { extractProcedureCandidatesFromSections } from '../lib/protocol-intake-runtime/extract-procedure-candidates'
import type {
  ProtocolRuntimeSectionRow,
  ProtocolRuntimeVisitCandidateRow,
} from '../lib/protocol-intake-runtime/protocol-intake-types'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runUnitChecks() {
  console.log('--- Phase P1 unit checks ---')

  const raw = `
1 INTRODUCTION
This is a protocol.

2 SCHEDULE OF ACTIVITIES
V1 - Screening
V2 - Baseline

Assessments:
- Vital signs
- ECG
`

  const sections = extractProtocolSectionsFromText(raw)
  assert(sections.length >= 2, 'sections extracted')
  assert(sections.some((s) => s.section_type === 'schedule_of_activities'), 'SoA section classified')

  // Fake section rows for visit/procedure extractors (minimal shape).
  const sectionRows: ProtocolRuntimeSectionRow[] = sections.map((s, idx) => ({
    id: `sec-${idx + 1}`,
    protocolVersionId: 'ver-1',
    sectionCode: s.section_code,
    sectionTitle: s.section_title,
    sectionType: s.section_type,
    sequenceOrder: s.sequence_order,
    extractedText: s.extracted_text,
    extractionConfidence: s.extraction_confidence,
    requiresReview: s.requires_review,
    metadata: s.metadata,
    createdAt: new Date().toISOString(),
  }))

  const visits = extractVisitCandidatesFromSections(sectionRows)
  assert(visits.length >= 1, 'visit candidates extracted')

  const visitRows: ProtocolRuntimeVisitCandidateRow[] = visits.map((v, idx) => ({
    id: `visit-${idx + 1}`,
    protocolVersionId: 'ver-1',
    visitCode: v.visit_code,
    visitName: v.visit_name,
    visitType: v.visit_type,
    studyDay: v.study_day,
    windowBeforeDays: v.window_before_days,
    windowAfterDays: v.window_after_days,
    extractedFromSectionId: v.extracted_from_section_id,
    confidenceScore: v.confidence_score,
    reconciliationStatus: 'unreviewed',
    metadata: v.metadata,
    createdAt: new Date().toISOString(),
  }))

  const procedures = extractProcedureCandidatesFromSections({
    sections: sectionRows,
    visits: visitRows,
  })
  assert(procedures.length >= 1, 'procedure candidates extracted')

  console.log('✅ Sections + visit/procedure candidates extracted (heuristics)')
}

async function runLiveChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⏭️  Skipping live checks (Supabase env not set)')
    return
  }

  console.log('--- Phase P1 live integration ---')
  const supabase = createClient(url, key)

  const orgId = process.env.PROTOCOL_INTAKE_SMOKE_ORG_ID
  if (!orgId) {
    console.log('⏭️  Set PROTOCOL_INTAKE_SMOKE_ORG_ID to run live checks')
    return
  }

  // Basic surface check: tables exist and are queryable with service role.
  const { error: pingErr } = await supabase.from('protocol_runtime_studies').select('id').limit(1)
  if (pingErr) throw new Error(pingErr.message)

  console.log('✅ Protocol intake runtime tables reachable')
}

async function main() {
  runUnitChecks()
  if (LIVE) await runLiveChecks()
  console.log('------------------------------------------------------------')
  console.log('Phase P1 protocol intake runtime smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})

