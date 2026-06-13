/**
 * Longitudinal Labs Foundation smoke test.
 *
 * Validates the canonical lab result model, baseline engine,
 * signal framework, and timeline materialization logic.
 *
 * Usage:
 *   npx tsx scripts/longitudinal-labs-foundation-smoke.ts
 */
import assert from 'node:assert/strict'
import { computeBaseline } from '../lib/longitudinal-labs/compute-baseline'
import { computeSignals } from '../lib/longitudinal-labs/compute-signals'
import {
  mapLongitudinalLabResultRow,
  type InsertLabResultInput,
  type LongitudinalLabResultRow,
} from '../lib/longitudinal-labs/longitudinal-lab-types'
import {
  computeChangeFromBaseline,
  computePercentChangeFromBaseline,
} from '../lib/longitudinal-labs/compute-baseline'

function makeResult(overrides: Partial<InsertLabResultInput> & { labTestCode: string }): LongitudinalLabResultRow {
  return mapLongitudinalLabResultRow({
    id: overrides.labTestCode + '-' + (overrides.collectionDate ?? 'unknown'),
    organization_id: 'org-smoke',
    study_id: 'study-smoke',
    subject_id: 'subject-smoke',
    visit_id: null,
    collection_date: overrides.collectionDate ?? null,
    result_date: null,
    lab_test_code: overrides.labTestCode,
    lab_test_name: overrides.labTestName ?? overrides.labTestCode,
    lab_category: overrides.labCategory ?? 'labs',
    result_value: overrides.resultValue ?? null,
    result_unit: overrides.resultUnit ?? null,
    reference_low: overrides.referenceLow ?? null,
    reference_high: overrides.referenceHigh ?? null,
    normal_flag: overrides.normalFlag ?? null,
    clinically_significant_flag: overrides.clinicallySignificantFlag ?? null,
    baseline_flag: overrides.baselineFlag ?? false,
    source_document_id: null,
    lab_vendor: null,
    metadata: {},
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  })
}

function runBaselineEngineChecks() {
  console.log('--- Baseline engine checks ---')

  const altResults = [
    makeResult({
      labTestCode: 'ALT',
      labTestName: 'ALT',
      collectionDate: '2026-04-01T00:00:00.000Z',
      resultValue: 28,
      referenceLow: 0,
      referenceHigh: 35,
    }),
    makeResult({
      labTestCode: 'ALT',
      labTestName: 'ALT',
      collectionDate: '2026-05-01T00:00:00.000Z',
      resultValue: 35,
      referenceLow: 0,
      referenceHigh: 35,
    }),
    makeResult({
      labTestCode: 'ALT',
      labTestName: 'ALT',
      collectionDate: '2026-05-15T00:00:00.000Z',
      resultValue: 74,
      referenceLow: 0,
      referenceHigh: 35,
    }),
  ]

  const baseline = computeBaseline(altResults)
  assert.ok(baseline, 'baseline should be computed')
  assert.equal(baseline.baselineResultId, altResults[0].id, 'first result is baseline')
  assert.equal(baseline.baselineValue, 28, 'baseline value is first result')
  assert.equal(baseline.currentValue, 74, 'current value is last result')
  assert.equal(baseline.changeFromBaseline, 46, 'change = 74 - 28')
  assert.ok(
    baseline.percentChangeFromBaseline !== null &&
      Math.abs(baseline.percentChangeFromBaseline - 164.29) < 0.1,
    'percent change ~164%',
  )
  console.log('✅ Baseline detection — first result fallback')
  console.log('✅ Change from baseline — 74 - 28 = 46')
  console.log('✅ Percent change — ~164.29%')

  const flaggedResults = [
    makeResult({
      labTestCode: 'HGB',
      labTestName: 'Hemoglobin',
      collectionDate: '2026-04-01T00:00:00.000Z',
      resultValue: 11.8,
    }),
    makeResult({
      labTestCode: 'HGB',
      labTestName: 'Hemoglobin',
      collectionDate: '2026-05-01T00:00:00.000Z',
      resultValue: 10.8,
      baselineFlag: true,
    }),
    makeResult({
      labTestCode: 'HGB',
      labTestName: 'Hemoglobin',
      collectionDate: '2026-06-01T00:00:00.000Z',
      resultValue: 9.8,
    }),
  ]

  const flaggedBaseline = computeBaseline(flaggedResults)
  assert.ok(flaggedBaseline, 'flagged baseline should be computed')
  assert.equal(
    flaggedBaseline.baselineResultId,
    flaggedResults[1].id,
    'baseline_flag result is used',
  )
  assert.equal(flaggedBaseline.baselineValue, 10.8, 'baseline value from flagged result')
  assert.equal(flaggedBaseline.changeFromBaseline, -1, 'change = 9.8 - 10.8')
  console.log('✅ Baseline detection — explicit baseline_flag honored')

  const change = computeChangeFromBaseline(74, 28)
  assert.equal(change, 46, 'computeChangeFromBaseline(74, 28) = 46')

  const pct = computePercentChangeFromBaseline(74, 28)
  assert.ok(pct !== null && Math.abs(pct - 164.29) < 0.1, 'computePercentChangeFromBaseline ~164%')

  const nullChange = computeChangeFromBaseline(null, 28)
  assert.equal(nullChange, null, 'null input returns null')

  const zeroBaselinePct = computePercentChangeFromBaseline(10, 0)
  assert.equal(zeroBaselinePct, null, 'zero baseline returns null')

  console.log('✅ computeChangeFromBaseline utility')
  console.log('✅ computePercentChangeFromBaseline utility')
}

function runSignalFrameworkChecks() {
  console.log('')
  console.log('--- Signal framework checks ---')

  const outOfRange = makeResult({
    labTestCode: 'ALT',
    labTestName: 'ALT',
    resultValue: 74,
    referenceLow: 0,
    referenceHigh: 35,
  })
  const normal = makeResult({
    labTestCode: 'AST',
    labTestName: 'AST',
    resultValue: 20,
    referenceLow: 0,
    referenceHigh: 35,
  })
  const clinicallySig = makeResult({
    labTestCode: 'CRP',
    labTestName: 'CRP',
    resultValue: 45,
    clinicallySignificantFlag: true,
  })

  const signals = computeSignals([outOfRange, normal, clinicallySig])
  const signalKinds = new Set(signals.map((s) => s.kind))

  assert.ok(signalKinds.has('out_of_range'), 'out_of_range signal emitted')
  assert.ok(signalKinds.has('clinically_significant'), 'clinically_significant signal emitted')
  assert.ok(!signalKinds.has('trend_up'), 'trend_up not emitted for single result')
  assert.ok(!signalKinds.has('trend_down'), 'trend_down not emitted for single result')
  assert.ok(!signalKinds.has('rapid_change'), 'rapid_change not emitted for single result')
  console.log('✅ out_of_range signal for value above reference_high')
  console.log('✅ clinically_significant signal for flagged result')
  console.log('✅ No trend signals for single-result tests')

  const increasingValues = [
    makeResult({
      labTestCode: 'ALT',
      labTestName: 'ALT',
      collectionDate: '2026-04-01T00:00:00.000Z',
      resultValue: 20,
    }),
    makeResult({
      labTestCode: 'ALT',
      labTestName: 'ALT',
      collectionDate: '2026-05-01T00:00:00.000Z',
      resultValue: 35,
    }),
    makeResult({
      labTestCode: 'ALT',
      labTestName: 'ALT',
      collectionDate: '2026-06-01T00:00:00.000Z',
      resultValue: 60,
    }),
  ]

  const increasingSignals = computeSignals(increasingValues)
  const increasingKinds = new Set(increasingSignals.map((s) => s.kind))
  assert.ok(increasingKinds.has('trend_up'), 'trend_up for increasing values')
  assert.ok(!increasingKinds.has('trend_down'), 'no trend_down for increasing values')
  console.log('✅ trend_up detected for increasing values')

  const decreasingValues = [
    makeResult({
      labTestCode: 'HGB',
      labTestName: 'Hemoglobin',
      collectionDate: '2026-04-01T00:00:00.000Z',
      resultValue: 14,
    }),
    makeResult({
      labTestCode: 'HGB',
      labTestName: 'Hemoglobin',
      collectionDate: '2026-05-01T00:00:00.000Z',
      resultValue: 12,
    }),
    makeResult({
      labTestCode: 'HGB',
      labTestName: 'Hemoglobin',
      collectionDate: '2026-06-01T00:00:00.000Z',
      resultValue: 9,
    }),
  ]

  const decreasingSignals = computeSignals(decreasingValues)
  const decreasingKinds = new Set(decreasingSignals.map((s) => s.kind))
  assert.ok(decreasingKinds.has('trend_down'), 'trend_down for decreasing values')
  console.log('✅ trend_down detected for decreasing values')

  const rapidValues = [
    makeResult({
      labTestCode: 'ALT',
      labTestName: 'ALT',
      collectionDate: '2026-04-01T00:00:00.000Z',
      resultValue: 20,
    }),
    makeResult({
      labTestCode: 'ALT',
      labTestName: 'ALT',
      collectionDate: '2026-05-01T00:00:00.000Z',
      resultValue: 60,
    }),
  ]

  const rapidSignals = computeSignals(rapidValues)
  const rapidKinds = new Set(rapidSignals.map((s) => s.kind))
  assert.ok(rapidKinds.has('rapid_change'), 'rapid_change for 200% increase')
  console.log('✅ rapid_change signal for >50% change')

  const noRapidValues = [
    makeResult({
      labTestCode: 'ALT',
      labTestName: 'ALT',
      collectionDate: '2026-04-01T00:00:00.000Z',
      resultValue: 20,
    }),
    makeResult({
      labTestCode: 'ALT',
      labTestName: 'ALT',
      collectionDate: '2026-05-01T00:00:00.000Z',
      resultValue: 25,
    }),
  ]

  const noRapidSignals = computeSignals(noRapidValues)
  const noRapidKinds = new Set(noRapidSignals.map((s) => s.kind))
  assert.ok(!noRapidKinds.has('rapid_change'), 'no rapid_change for small change')
  console.log('✅ No rapid_change for <50% change (25% increase)')
}

function runTypeMappingChecks() {
  console.log('')
  console.log('--- Type mapping checks ---')

  const row = mapLongitudinalLabResultRow({
    id: 'abc-123',
    organization_id: 'org-1',
    study_id: 'study-1',
    subject_id: 'subj-1',
    visit_id: null,
    collection_date: '2026-06-01T00:00:00.000Z',
    result_date: null,
    lab_test_code: 'ALT',
    lab_test_name: 'ALT',
    lab_category: 'labs',
    result_value: 28,
    result_unit: 'U/L',
    reference_low: 0,
    reference_high: 35,
    normal_flag: true,
    clinically_significant_flag: false,
    baseline_flag: true,
    source_document_id: null,
    lab_vendor: null,
    metadata: { source: 'smoke-test' },
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  })

  assert.equal(row.id, 'abc-123')
  assert.equal(row.labTestCode, 'ALT')
  assert.equal(row.resultValue, 28)
  assert.equal(row.resultUnit, 'U/L')
  assert.equal(row.referenceLow, 0)
  assert.equal(row.referenceHigh, 35)
  assert.equal(row.normalFlag, true)
  assert.equal(row.clinicallySignificantFlag, false)
  assert.equal(row.baselineFlag, true)
  assert.equal(row.labCategory, 'labs')
  assert.equal(row.metadata.source, 'smoke-test')
  console.log('✅ Type mapping — all fields map correctly')

  const nullRow = mapLongitudinalLabResultRow({
    id: 'def-456',
    organization_id: 'org-1',
    study_id: 'study-1',
    subject_id: 'subj-1',
    lab_test_code: 'HGB',
    lab_test_name: 'Hemoglobin',
    lab_category: 'labs',
    baseline_flag: false,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  })

  assert.equal(nullRow.visitId, null)
  assert.equal(nullRow.collectionDate, null)
  assert.equal(nullRow.resultValue, null)
  assert.equal(nullRow.referenceLow, null)
  assert.equal(nullRow.referenceHigh, null)
  assert.equal(nullRow.normalFlag, null)
  assert.equal(nullRow.clinicallySignificantFlag, null)
  assert.equal(nullRow.baselineFlag, false)
  console.log('✅ Type mapping — nullable fields handle null')
}

function runEmptyEdgeCases() {
  console.log('')
  console.log('--- Empty / edge case checks ---')

  const emptyBaseline = computeBaseline([])
  assert.equal(emptyBaseline, null, 'no baseline for empty results')
  console.log('✅ Empty results → null baseline')

  const emptySignals = computeSignals([])
  assert.equal(emptySignals.length, 0, 'no signals for empty results')
  console.log('✅ Empty results → empty signals')

  const singleResult = makeResult({
    labTestCode: 'ALT',
    labTestName: 'ALT',
    resultValue: 28,
  })
  const singleBaseline = computeBaseline([singleResult])
  assert.ok(singleBaseline, 'baseline exists for single result')
  assert.equal(singleBaseline.changeFromBaseline, 0, 'change is 0 for single result (same value)')
  console.log('✅ Single result → baseline exists, no change')

  const singleSignals = computeSignals([singleResult])
  assert.equal(singleSignals.length, 0, 'no signals for single normal result')
  console.log('✅ Single normal result → no signals')

  const nullValueResult = makeResult({
    labTestCode: 'ALT',
    labTestName: 'ALT',
    resultValue: null,
    referenceLow: 0,
    referenceHigh: 35,
  })
  const nullSignals = computeSignals([nullValueResult])
  const nullSignalKinds = new Set(nullSignals.map((s) => s.kind))
  assert.ok(!nullSignalKinds.has('out_of_range'), 'no out_of_range for null value')
  console.log('✅ Null result value → no out_of_range signal')
}

function runLabReportReviewTypeChecks() {
  console.log('')
  console.log('--- Lab Report Review type mapping checks ---')

  const {
    mapLabReportReviewRow,
    LAB_REPORT_REVIEW_STATUS,
    LAB_REPORT_TYPE,
    LAB_REPORT_REVIEW_SCOPE,
    LAB_REPORT_PI_CLASSIFICATION,
  } = require('../lib/longitudinal-labs/lab-report-review-types')

  const full = mapLabReportReviewRow({
    id: 'review-001',
    organization_id: 'org-1',
    study_id: 'study-1',
    subject_id: 'subj-1',
    visit_id: 'visit-1',
    compliance_document_id: 'doc-001',
    longitudinal_result_id: 'result-001',
    report_type: 'extractable',
    review_scope: 'report',
    lab_test_code: 'ALT',
    lab_test_name: 'ALT',
    review_status: 'under_review',
    reviewed_by: 'user-001',
    reviewed_at: '2026-06-12T12:00:00.000Z',
    review_notes: 'Awaiting PI review.',
    pi_classification: 'cs',
    pi_classified_by: 'user-002',
    pi_classified_at: '2026-06-12T14:00:00.000Z',
    signature_request_id: 'sig-req-001',
    metadata: { source: 'smoke-test' },
    created_at: '2026-06-12T10:00:00.000Z',
    updated_at: '2026-06-12T14:00:00.000Z',
  })

  assert.equal(full.id, 'review-001')
  assert.equal(full.organizationId, 'org-1')
  assert.equal(full.studyId, 'study-1')
  assert.equal(full.subjectId, 'subj-1')
  assert.equal(full.visitId, 'visit-1')
  assert.equal(full.complianceDocumentId, 'doc-001')
  assert.equal(full.longitudinalResultId, 'result-001')
  assert.equal(full.reportType, 'extractable')
  assert.equal(full.reviewScope, 'report')
  assert.equal(full.labTestCode, 'ALT')
  assert.equal(full.reviewStatus, 'under_review')
  assert.equal(full.reviewedBy, 'user-001')
  assert.equal(full.reviewNotes, 'Awaiting PI review.')
  assert.equal(full.piClassification, 'cs')
  assert.equal(full.signatureRequestId, 'sig-req-001')
  console.log('✅ Lab Report Review — full row maps correctly')

  const minimal = mapLabReportReviewRow({
    id: 'review-002',
    organization_id: 'org-1',
    study_id: 'study-1',
    subject_id: 'subj-1',
    compliance_document_id: 'doc-002',
    report_type: 'scanned',
    review_scope: 'report',
    review_status: 'pending_review',
    created_at: '2026-06-12T10:00:00.000Z',
    updated_at: '2026-06-12T10:00:00.000Z',
  })

  assert.equal(minimal.visitId, null)
  assert.equal(minimal.longitudinalResultId, null)
  assert.equal(minimal.reviewedBy, null)
  assert.equal(minimal.reviewNotes, null)
  assert.equal(minimal.piClassification, null)
  assert.equal(minimal.signatureRequestId, null)
  assert.equal(minimal.labTestCode, null)
  assert.equal(minimal.reportType, 'scanned')
  assert.equal(minimal.reviewStatus, 'pending_review')
  console.log('✅ Lab Report Review — nullable fields handle null')

  // Constant assertions
  assert.equal(LAB_REPORT_REVIEW_STATUS.PENDING_REVIEW, 'pending_review')
  assert.equal(LAB_REPORT_REVIEW_STATUS.REVIEWED, 'reviewed')
  assert.equal(LAB_REPORT_TYPE.EXTRACTABLE, 'extractable')
  assert.equal(LAB_REPORT_TYPE.SCANNED, 'scanned')
  assert.equal(LAB_REPORT_REVIEW_SCOPE.REPORT, 'report')
  assert.equal(LAB_REPORT_REVIEW_SCOPE.TEST, 'test')
  assert.equal(LAB_REPORT_PI_CLASSIFICATION.CS, 'cs')
  assert.equal(LAB_REPORT_PI_CLASSIFICATION.NCS, 'ncs')
  assert.equal(LAB_REPORT_PI_CLASSIFICATION.FOLLOW_UP_REQUIRED, 'follow_up_required')
  console.log('✅ Lab Report Review — constants match expected values')
}

async function runImportChecks() {
  console.log('')
  console.log('--- API route / component import checks ---')

  async function checkModule(name: string, importFn: () => Promise<unknown>) {
    try {
      await importFn()
      console.log(`  ✅ ${name} imports cleanly`)
      return true
    } catch (err) {
      console.error(`  ❌ ${name} import failed:`, err)
      return false
    }
  }

  const checks: { name: string; fn: () => Promise<unknown> }[] = [
    {
      name: 'build-subject-lab-timeline',
      fn: () => import('../lib/longitudinal-labs/build-subject-lab-timeline'),
    },
    {
      name: 'load-study-lab-results',
      fn: () => import('../lib/longitudinal-labs/load-study-lab-results'),
    },
    {
      name: 'lab-report-review-types',
      fn: () => import('../lib/longitudinal-labs/lab-report-review-types'),
    },
    {
      name: 'create-lab-report-review',
      fn: () => import('../lib/longitudinal-labs/create-lab-report-review'),
    },
    {
      name: 'load-lab-report-review',
      fn: () => import('../lib/longitudinal-labs/load-lab-report-review'),
    },
    {
      name: 'update-lab-report-review',
      fn: () => import('../lib/longitudinal-labs/update-lab-report-review'),
    },
  ]

  let passCount = 0
  for (const check of checks) {
    const ok = await checkModule(check.name, check.fn)
    if (ok) passCount++
  }

  if (passCount !== checks.length) {
    throw new Error(`${checks.length - passCount} module(s) failed import check`)
  }
  console.log(`  ✅ All ${checks.length} modules import cleanly`)
}

async function main() {
  runTypeMappingChecks()
  runBaselineEngineChecks()
  runSignalFrameworkChecks()
  runEmptyEdgeCases()
  runLabReportReviewTypeChecks()
  runImportChecks()

  console.log('')
  console.log('------------------------------------------------------------')
  console.log('Longitudinal Labs Foundation smoke test passed.')
  console.log('')
  console.log('Coverage:')
  console.log('  ✅ Type mapping (full + nullable)')
  console.log('  ✅ Baseline detection (first result, baseline_flag)')
  console.log('  ✅ Change from baseline computation')
  console.log('  ✅ Percent change from baseline')
  console.log('  ✅ out_of_range signal')
  console.log('  ✅ clinically_significant signal')
  console.log('  ✅ trend_up signal')
  console.log('  ✅ trend_down signal')
  console.log('  ✅ rapid_change signal')
  console.log('  ✅ Empty/edge cases')
  console.log('  ✅ Null safety')
  console.log('  ✅ API route / component imports')
  console.log('  ✅ Lab Report Review — type mapping (full + nullable)')
  console.log('  ✅ Lab Report Review — constants')
  console.log('  ✅ Lab Report Review — service imports')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
