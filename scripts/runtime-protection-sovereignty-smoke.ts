/**
 * Runtime sovereignty smoke — validates protection types only (no runtime hooks).
 * Run: npx tsx scripts/runtime-protection-sovereignty-smoke.ts
 */
import assert from 'node:assert/strict'
import {
  DEFAULT_DENY_EXPOSURE_POLICY,
  INSPECTION_READINESS_EXPOSURE_TEMPLATE,
  NEVER_RAW_EXTERNAL_VISIBILITY,
  RUNTIME_VISIBILITY_CLASS,
  assertSiteControlledVisibility,
  rejectsSurveillancePolicy,
  validateExposurePolicy,
} from '../lib/runtime-protection'

function main() {
  for (const v of NEVER_RAW_EXTERNAL_VISIBILITY) {
    assert.equal(assertSiteControlledVisibility(v).allowed, false)
  }
  assert.equal(assertSiteControlledVisibility(RUNTIME_VISIBILITY_CLASS.DERIVED_EXTERNAL).allowed, true)

  assert.equal(validateExposurePolicy(DEFAULT_DENY_EXPOSURE_POLICY).ok, true)
  assert.equal(validateExposurePolicy(INSPECTION_READINESS_EXPOSURE_TEMPLATE).ok, true)

  const bad = { ...INSPECTION_READINESS_EXPOSURE_TEMPLATE, derivedOnly: false }
  assert.equal(validateExposurePolicy(bad).ok, false)

  assert.equal(rejectsSurveillancePolicy(DEFAULT_DENY_EXPOSURE_POLICY), false)
  assert.equal(rejectsSurveillancePolicy({ ...INSPECTION_READINESS_EXPOSURE_TEMPLATE, derivedOnly: false }), true)

  console.log('runtime-protection-sovereignty-smoke: PASS')
}

main()
