/**
 * Phase 3 protocol graph smoke — static module + compile contract checks (no DB).
 */
import assert from 'node:assert/strict'
import { computeGraphSourceChecksum } from '../lib/protocol-graph/compile/checksum'
import { BUILTIN_PROTOCOL_GRAPH_RULES, resolveBuiltinRules } from '../lib/protocol-graph/rules/builtin-catalog'
import { PROTOCOL_GRAPH_SCHEMA_VERSION } from '../lib/protocol-graph/types'

function smokeBuiltinCatalog() {
  assert.ok(BUILTIN_PROTOCOL_GRAPH_RULES.cbc_abnormality_safety)
  assert.ok(BUILTIN_PROTOCOL_GRAPH_RULES.unresolved_ae_signoff_block)
  assert.ok(BUILTIN_PROTOCOL_GRAPH_RULES.pk_branch_activation)
  const rules = resolveBuiltinRules([
    'cbc_abnormality_safety',
    'unresolved_ae_signoff_block',
    'pk_branch_activation',
    'adrenal_monitoring_escalation',
    'repeated_lab_dependency',
  ])
  assert.equal(rules.length, 5)
  assert.equal(rules[0]?.kind, 'safety_trigger')
}

function smokeChecksumStability() {
  const a = computeGraphSourceChecksum({ studyId: 's1', visits: ['v1'] })
  const b = computeGraphSourceChecksum({ studyId: 's1', visits: ['v1'] })
  const c = computeGraphSourceChecksum({ visits: ['v1'], studyId: 's1' })
  assert.equal(a, b)
  assert.equal(a, c)
  assert.notEqual(a, computeGraphSourceChecksum({ studyId: 's2', visits: ['v1'] }))
}

function smokeSchemaVersion() {
  assert.equal(PROTOCOL_GRAPH_SCHEMA_VERSION, 1)
}

function main() {
  smokeBuiltinCatalog()
  smokeChecksumStability()
  smokeSchemaVersion()
  console.log('phase3-protocol-graph-smoke: OK')
}

main()
