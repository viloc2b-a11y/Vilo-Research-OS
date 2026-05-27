/**
 * K2 / P4C smoke: Source Blueprint Evidence Layer
 */
import fs from 'node:fs'
import path from 'node:path'
import { classifyChunkEvidenceKinds } from '../lib/source-blueprint-evidence/classify-chunk-evidence'
import { buildLineageCandidatesFromBlueprint } from '../lib/source-blueprint-evidence/load-blueprint-lineage-candidates'
import { inferDefaultTraceOrigin } from '../lib/source-blueprint-evidence/infer-default-trace-origin'
import { EVIDENCE_KIND, EVIDENCE_STATUS } from '../lib/source-blueprint-evidence/source-blueprint-evidence-types'
import { LINEAGE_ELEMENT_TYPE, TRACE_ORIGIN } from '../lib/source-blueprint-evidence/source-lineage-types'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function assertNoRuntimeMutationInDir(dir: string) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8')
    assert(
      !content.includes('publish_runtime') &&
        !content.includes('publishRuntime') &&
        !content.includes('publish_source_package') &&
        !content.includes('runtime_source_package') &&
        !content.includes('approveReconciliation'),
      `${file} must not invoke runtime publish or reconciliation`,
    )
    assert(
      !content.includes("from('procedure_blueprint_versions').update") &&
        !content.includes("from('procedure_blueprint_versions').insert") &&
        !content.includes("from('procedure_blueprint_versions').upsert"),
      `${file} must not mutate blueprint content`,
    )
  }
}

function runChecks() {
  console.log('--- Source Blueprint Evidence K2/P4C checks ---')

  const visitText =
    'Visit window Day -7 to Day 0 screening baseline follow-up schedule within 14 days.'
  const visitKinds = classifyChunkEvidenceKinds(visitText, 'source_creation')
  assert(
    visitKinds.some((k) => k.evidenceKind === EVIDENCE_KIND.VISIT_WINDOW),
    'classifier detects visit window',
  )

  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/0125_source_blueprint_evidence.sql'),
    'utf8',
  )
  const lineageMigration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/0126_source_blueprint_evidence_lineage.sql'),
    'utf8',
  )
  const closureMigration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/0130_document_intelligence_k2_closure_alignment.sql'),
    'utf8',
  )

  assert(
    migration.includes("'pending_review'") && migration.includes("'superseded'"),
    'evidence statuses include pending_review and superseded',
  )
  assert(
    closureMigration.includes("'superseded_candidate'"),
    'active-reference changes mark affected evidence for coordinator review',
  )
  assert(
    !migration.match(/evidence_status in \([^)]*'extracted'/),
    'extracted is not an evidence row status',
  )
  assert(
    !migration.replace(/--[^\n]*/g, '').includes('organization_id = auth.uid()'),
    '0125 RLS does not use organization_id = auth.uid()',
  )
  assert(
    migration.includes('user_has_study_access(study_id)'),
    '0125 RLS uses study access',
  )

  assert(
    lineageMigration.includes('source_section') &&
      lineageMigration.includes('validation_rule') &&
      lineageMigration.includes('signature_placeholder'),
    'lineage element types defined',
  )
  assert(
    lineageMigration.includes('protocol_evidence') &&
      lineageMigration.includes('manual_reconciliation_decision'),
    'trace origins defined',
  )
  assert(
    !lineageMigration.replace(/--[^\n]*/g, '').includes('organization_id = auth.uid()'),
    '0126 RLS does not use organization_id = auth.uid()',
  )

  const candidates = buildLineageCandidatesFromBlueprint(
    {
      sections: [
        {
          section_id: 'sec_vitals',
          title: 'Vitals',
          fields: [{ field_id: 'bp_sys', type: 'number', label: 'Systolic BP' }],
          instructions: 'Measure before labs',
        },
      ],
      signature_requirements: { pi_sign: { role: 'PI' } },
    },
    { validation_rules: [{ id: 'vr1', label: 'Required BP' }] },
  )
  assert(
    candidates.some((c) => c.elementType === LINEAGE_ELEMENT_TYPE.SOURCE_FIELD),
    'lineage candidates include fields',
  )
  assert(
    candidates.some((c) => c.elementType === LINEAGE_ELEMENT_TYPE.VALIDATION_RULE),
    'lineage candidates include validation rules',
  )

  assert(
    inferDefaultTraceOrigin('source_creation', EVIDENCE_KIND.SOURCE_DRAFTING) ===
      TRACE_ORIGIN.CRF_GUIDANCE,
    'default trace origin for source drafting',
  )

  const libDir = path.join(process.cwd(), 'lib/source-blueprint-evidence')
  assertNoRuntimeMutationInDir(libDir)

  const mapSource = fs.readFileSync(path.join(libDir, 'map-source-blueprint-evidence.ts'), 'utf8')
  assert(mapSource.includes('replaceEvidenceLineage'), 'map persists lineage rows')
  assert(mapSource.includes('runtime_mutated: false'), 'map audit records no runtime mutation')
  assert(
    mapSource.includes('blueprint_content_mutated: false'),
    'map audit records no blueprint mutation',
  )

  const uiClient = fs.readFileSync(
    path.join(process.cwd(), 'components/source-blueprint-evidence/source-evidence-review-client.tsx'),
    'utf8',
  )
  assert(uiClient.includes('not directly from a PDF'), 'UI states source not from PDF')
  assert(
    !uiClient.includes('AI generated final source') &&
      !uiClient.includes('Auto-approved') &&
      !uiClient.includes('Published automatically'),
    'forbidden UI language absent',
  )

  assert(EVIDENCE_STATUS.PENDING_REVIEW === 'pending_review', 'pending_review status')
  assert(
    EVIDENCE_STATUS.SUPERSEDED_CANDIDATE === 'superseded_candidate',
    'superseded_candidate status',
  )
  assert(EVIDENCE_STATUS.SUPERSEDED === 'superseded', 'superseded status')

  console.log('✅ Evidence classification')
  console.log('✅ Migrations 0125 + 0126 RLS and lifecycle')
  console.log('✅ Lineage candidates + trace origins')
  console.log('✅ No runtime / blueprint mutation in lib')
  console.log('✅ Coordinator UI language')
}

runChecks()
console.log('------------------------------------------------------------')
console.log('Source Blueprint Evidence K2/P4C smoke test passed.')
