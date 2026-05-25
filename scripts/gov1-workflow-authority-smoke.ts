/**
 * GOV-1 — Workflow decision authority smoke (no DB; classification + contract only).
 * Run: npx tsx scripts/gov1-workflow-authority-smoke.ts
 */
import assert from 'node:assert/strict'
import {
  buildGovernedWorkflowTraceRefs,
  GOV1_CORE_WORKFLOW_KEYS,
  mapWorkflowAuthorityEscalationRuleRow,
  mapWorkflowDecisionAuthorityRow,
  rejectFreeTextAuthorityValue,
  WORKFLOW_AUTHORITY_LEVEL,
  WORKFLOW_ESCALATION_RULE_KEY,
  WORKFLOW_KEY,
} from '../lib/governance/workflow-authority'

function main() {
  assert.equal(GOV1_CORE_WORKFLOW_KEYS.length, 10)
  assert.ok(GOV1_CORE_WORKFLOW_KEYS.includes(WORKFLOW_KEY.ELIGIBILITY))
  assert.ok(GOV1_CORE_WORKFLOW_KEYS.includes(WORKFLOW_KEY.FINANCIAL_RECONCILIATION))

  const authority = mapWorkflowDecisionAuthorityRow({
    id: 'a1',
    organization_id: null,
    workflow_key: 'eligibility',
    category: 'clinical',
    base_authority_level: 'human_required',
    ai_allowed: true,
    human_confirmation_required: true,
    system_blocking: true,
    regulated: true,
    phi_sensitive: true,
    audit_required: true,
    conditional_escalation_supported: true,
    notes: null,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  assert.equal(authority.baseAuthorityLevel, WORKFLOW_AUTHORITY_LEVEL.HUMAN_REQUIRED)
  assert.equal(authority.conditionalEscalationSupported, true)

  const rule = mapWorkflowAuthorityEscalationRuleRow({
    id: 'r1',
    organization_id: null,
    workflow_key: 'lab_safety_escalation',
    rule_key: WORKFLOW_ESCALATION_RULE_KEY.SEVERE_THROMBOCYTOPENIA_OR_HIT_SIGNAL,
    condition_type: 'lab_result_rule',
    condition_expression: {
      any: [{ field: 'platelet_count', operator: '<', value: 150000 }],
    },
    from_authority_level: 'human_required',
    to_authority_level: 'system_enforced',
    requires_human_confirmation: true,
    system_blocking: true,
    regulated: true,
    audit_required: true,
    active: true,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  assert.equal(rule.toAuthorityLevel, WORKFLOW_AUTHORITY_LEVEL.SYSTEM_ENFORCED)

  const trace = buildGovernedWorkflowTraceRefs({
    workflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
    baseAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.SYSTEM_ENFORCED,
  })
  assert.equal(trace.baseAuthorityLevel, trace.effectiveAuthorityLevel)

  assert.throws(() => rejectFreeTextAuthorityValue('Human Required Signoff', 'tier'))

  assert.throws(() =>
    mapWorkflowDecisionAuthorityRow({
      id: 'bad',
      organization_id: null,
      workflow_key: 'unknown_workflow',
      category: 'clinical',
      base_authority_level: 'human_required',
      ai_allowed: false,
      human_confirmation_required: true,
      system_blocking: true,
      regulated: true,
      phi_sensitive: true,
      audit_required: true,
      conditional_escalation_supported: false,
      notes: null,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  )

  console.log('gov1-workflow-authority-smoke: PASS')
}

main()
