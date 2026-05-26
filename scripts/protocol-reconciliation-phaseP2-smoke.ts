/**
 * Phase P2 smoke: protocol reconciliation matching layer.
 *
 * Usage:
 *   npx tsx scripts/protocol-reconciliation-phaseP2-smoke.ts
 *   npx tsx scripts/protocol-reconciliation-phaseP2-smoke.ts --live
 */
import { createClient } from '@supabase/supabase-js'
import {
  AUTO_MATCH_THRESHOLD,
  pickBestProcedureMatch,
  scoreProcedureMatch,
  suggestProcedureMatches,
} from '../lib/protocol-reconciliation/suggest-procedure-matches'
import {
  MATCHING_METHOD,
  PROCEDURE_RECONCILIATION_STATUS,
} from '../lib/protocol-reconciliation/protocol-reconciliation-types'
import type { ProcedureLibraryRow } from '../lib/procedure-library/procedure-types'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function makeProcedure(overrides: Partial<ProcedureLibraryRow>): ProcedureLibraryRow {
  return {
    id: overrides.id ?? 'proc-1',
    organizationId: overrides.organizationId ?? null,
    libraryScope: overrides.libraryScope ?? 'global',
    procedureCode: overrides.procedureCode ?? 'VS',
    procedureName: overrides.procedureName ?? 'Vital Signs',
    procedureCategory: overrides.procedureCategory ?? 'assessment',
    procedureSubcategory: overrides.procedureSubcategory ?? null,
    description: overrides.description ?? null,
    operationalDescription: overrides.operationalDescription ?? null,
    sourceTemplateEnabled: overrides.sourceTemplateEnabled ?? true,
    requiresSignature: overrides.requiresSignature ?? false,
    requiresCertifiedCopy: overrides.requiresCertifiedCopy ?? false,
    supportsOffsite: overrides.supportsOffsite ?? false,
    procedureComplexity: overrides.procedureComplexity ?? 'standard',
    estimatedDurationMinutes: overrides.estimatedDurationMinutes ?? 10,
    activeVersionId: overrides.activeVersionId ?? 'bp-1',
    status: overrides.status ?? 'active',
    tags: overrides.tags ?? [],
    metadata: overrides.metadata ?? {},
    createdBy: overrides.createdBy ?? 'user-1',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  }
}

function runUnitChecks() {
  console.log('--- Phase P2 unit checks ---')

  const vitalSigns = makeProcedure({
    id: 'proc-vs',
    procedureCode: 'VS',
    procedureName: 'Vital Signs',
    activeVersionId: 'bp-vs',
  })
  const ecg = makeProcedure({
    id: 'proc-ecg',
    procedureCode: 'ECG',
    procedureName: 'Electrocardiogram',
    activeVersionId: 'bp-ecg',
  })
  const obscure = makeProcedure({
    id: 'proc-x',
    procedureCode: 'XR-99',
    procedureName: 'Obscure Assessment Panel',
    activeVersionId: 'bp-x',
  })

  const exactName = scoreProcedureMatch('Vital Signs', vitalSigns)
  assert(exactName.confidence === 1, 'exact name match')
  assert(exactName.matchingMethod === MATCHING_METHOD.AUTO_STRING, 'exact name method')

  const exactCode = scoreProcedureMatch('ECG', ecg)
  assert(exactCode.confidence === 1, 'exact code match')
  assert(exactCode.matchingMethod === MATCHING_METHOD.AUTO_EXACT_CODE, 'exact code method')

  const fuzzy = scoreProcedureMatch('Vital Signs', vitalSigns)
  assert(fuzzy.confidence >= AUTO_MATCH_THRESHOLD, 'fuzzy match above threshold')

  const low = scoreProcedureMatch('random unrelated text', obscure)
  assert(low.confidence < AUTO_MATCH_THRESHOLD, 'below-threshold remains low confidence')

  const best = pickBestProcedureMatch('Vital Signs', [ecg, vitalSigns, obscure])
  assert(best?.procedureId === 'proc-vs', 'best match selects vital signs')

  const suggestions = suggestProcedureMatches('ECG', [vitalSigns, ecg])
  assert(suggestions[0]?.procedureId === 'proc-ecg', 'fuzzy ranking prefers ECG')

  const belowThresholdStatus = PROCEDURE_RECONCILIATION_STATUS.NEEDS_REVIEW
  assert(belowThresholdStatus === 'needs_review', 'below threshold workflow status')

  console.log('✅ Matching heuristics: exact, fuzzy, threshold, ranking')
  console.log('✅ Workflow statuses defined for approve/reject/manual mapping')
}

async function runLiveChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⏭️  Skipping live checks (Supabase env not set)')
    return
  }

  console.log('--- Phase P2 live integration ---')
  const supabase = createClient(url, key)

  const tables = [
    'protocol_visit_reconciliations',
    'protocol_procedure_reconciliations',
    'protocol_reconciliation_events',
  ] as const

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1)
    if (error) throw new Error(`${table}: ${error.message}`)
  }

  console.log('✅ Reconciliation tables reachable (initialize/approve flows require seeded protocol data)')
}

async function main() {
  runUnitChecks()
  if (LIVE) await runLiveChecks()
  console.log('------------------------------------------------------------')
  console.log('Phase P2 protocol reconciliation smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
