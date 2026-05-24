/**
 * Phase 16A-1 — AI governance foundation smoke (static, no DB).
 * Run: npx tsx scripts/phase16a1-ai-governance-smoke.ts
 */
import assert from 'node:assert/strict'
import {
  AI_INCIDENT_SEVERITIES,
  AI_INCIDENT_STATUSES,
  AI_RISK_TIERS,
  AI_SYSTEM_STATUSES,
  defaultPhiAllowed,
  isAiIncidentSeverity,
  isAiIncidentStatus,
  isAiRiskTier,
  isAiSystemStatus,
  riskTierRequiresHumanInLoop,
  validateAiSystemInventoryInput,
  validateMetadataNonPhi,
} from '../lib/ai-governance'

function smokeConstants() {
  assert.deepEqual([...AI_RISK_TIERS], ['low', 'medium', 'high', 'critical'])
  assert.deepEqual([...AI_SYSTEM_STATUSES], ['draft', 'approved', 'active', 'paused', 'retired'])
  assert.deepEqual([...AI_INCIDENT_SEVERITIES], ['low', 'medium', 'high', 'critical'])
  assert.deepEqual([...AI_INCIDENT_STATUSES], ['open', 'investigating', 'mitigated', 'closed'])
  assert.equal(isAiRiskTier('high'), true)
  assert.equal(isAiRiskTier('unknown'), false)
  assert.equal(isAiSystemStatus('active'), true)
  assert.equal(isAiIncidentSeverity('critical'), true)
  assert.equal(isAiIncidentStatus('closed'), true)
}

function smokeHumanInLoopRules() {
  assert.equal(riskTierRequiresHumanInLoop('low'), false)
  assert.equal(riskTierRequiresHumanInLoop('medium'), false)
  assert.equal(riskTierRequiresHumanInLoop('high'), true)
  assert.equal(riskTierRequiresHumanInLoop('critical'), true)
  assert.equal(defaultPhiAllowed(), false)

  const highFail = validateAiSystemInventoryInput({
    organizationId: '00000000-0000-4000-8000-000000000001',
    systemName: 'Test',
    systemType: 'llm',
    ownerRole: 'research_coordinator',
    useCase: 'draft assist',
    riskTier: 'high',
    humanInLoopRequired: false,
  })
  assert.equal(highFail.ok, false)

  const criticalFail = validateAiSystemInventoryInput({
    organizationId: '00000000-0000-4000-8000-000000000001',
    systemName: 'Test',
    systemType: 'llm',
    ownerRole: 'research_coordinator',
    useCase: 'draft assist',
    riskTier: 'critical',
    humanInLoopRequired: false,
  })
  assert.equal(criticalFail.ok, false)

  const lowOk = validateAiSystemInventoryInput({
    organizationId: '00000000-0000-4000-8000-000000000001',
    systemName: 'Routing assist',
    systemType: 'rules_engine',
    ownerRole: 'data_coordinator',
    useCase: 'non-clinical routing labels',
    riskTier: 'low',
    humanInLoopRequired: true,
    phiAllowed: false,
    metadata: { environment: 'staging', feature_flag: 'gov0' },
  })
  assert.equal(lowOk.ok, true)
  if (lowOk.ok) {
    assert.equal(lowOk.normalized.phiAllowed, false)
    assert.equal(lowOk.normalized.humanInLoopRequired, true)
  }
}

function smokeMetadataNonPhi() {
  const issues = validateMetadataNonPhi({
    patient_name: 'should-not-appear',
    config: { ok: true },
  })
  assert.ok(issues.length > 0)
  assert.deepEqual(validateMetadataNonPhi({ layer: 'gov-0', version: 1 }), [])
}

function main() {
  smokeConstants()
  smokeHumanInLoopRules()
  smokeMetadataNonPhi()
  console.log('Phase 16A-1 AI governance smoke: PASS')
}

main()
