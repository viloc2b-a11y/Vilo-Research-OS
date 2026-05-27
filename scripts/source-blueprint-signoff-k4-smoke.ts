/**
 * K4 smoke: Formal Sign-off + Audit Export.
 * Static guardrails for evidence -> draft suggestion -> sign-off -> audit package.
 */
import fs from 'node:fs'
import path from 'node:path'
import { computeSourceBlueprintAuditPackageHash } from '../lib/source-blueprint-signoff/audit-package-hash'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function assertNoRuntimeMutation(relativePath: string) {
  const content = read(relativePath)
  const forbidden = [
    "from('runtime_source_packages')",
    "from('runtime_source_visit_shells')",
    "from('runtime_source_procedure_shells')",
    "from('runtime_source_package_publications')",
    "from('published_source_definition_versions')",
    "from('published_source_sections')",
    "from('published_source_fields')",
    "from('visit_instances')",
    "from('visit_procedure_instances')",
    'publish_source_package',
    'publishRuntime',
    'approveReconciliation',
  ]
  for (const token of forbidden) {
    assert(!content.includes(token), `${relativePath} must not contain ${token}`)
  }
}

function runChecks() {
  console.log('--- Source Blueprint Sign-off K4 checks ---')

  const migration = read('supabase/migrations/0132_source_blueprint_signoff_audit_export.sql')
  assert(migration.includes('source_blueprint_draft_signoffs'), 'sign-off table exists')
  assert(migration.includes('source_blueprint_audit_exports'), 'audit export table exists')
  assert(migration.includes('source_blueprint_audit_exports_deny_mutation'), 'audit exports append-only')
  assert(migration.includes('user_has_study_access(study_id)'), 'RLS uses study access')
  assert(
    !migration.replace(/--[^\n]*/g, '').includes('organization_id = auth.uid()'),
    'RLS does not use organization_id = auth.uid()',
  )

  const signoffSource = read('lib/source-blueprint-signoff/create-signoff.ts')
  assert(
    signoffSource.includes('ACCEPTED_FOR_MANUAL_USE'),
    'sign-off requires accepted-for-manual-use suggestions',
  )
  assert(signoffSource.includes('signoff_snapshot'), 'sign-off stores immutable snapshot')
  assert(signoffSource.includes('runtime_mutated: false'), 'sign-off records no runtime mutation')
  assert(
    signoffSource.includes('published_source_mutated: false'),
    'sign-off records no published source mutation',
  )
  assert(
    signoffSource.includes('reconciliation_mutated: false'),
    'sign-off records no reconciliation mutation',
  )

  const exportSource = read('lib/source-blueprint-signoff/create-audit-export.ts')
  assert(exportSource.includes('loadEvidenceLineage'), 'audit package includes lineage')
  assert(exportSource.includes('loadEvidenceReviewEvents'), 'audit package includes review events')
  assert(exportSource.includes('computeSourceBlueprintAuditPackageHash'), 'audit package is hashed')
  assert(exportSource.includes('runtimeMutated: false'), 'audit package records no runtime mutation')

  const libDir = path.join(process.cwd(), 'lib/source-blueprint-signoff')
  for (const file of fs.readdirSync(libDir).filter((name) => name.endsWith('.ts'))) {
    assertNoRuntimeMutation(path.join('lib/source-blueprint-signoff', file))
  }
  assertNoRuntimeMutation('app/api/source-blueprint-signoff/sign/route.ts')
  assertNoRuntimeMutation('app/api/source-blueprint-signoff/list/route.ts')
  assertNoRuntimeMutation('app/api/source-blueprint-signoff/audit-export/route.ts')

  const ui = read('components/source-blueprint-signoff/source-blueprint-signoff-client.tsx')
  assert(ui.includes('Formal Sign-off'), 'UI names formal sign-off')
  assert(ui.includes('Audit package'), 'UI names audit package')
  assert(ui.includes('published source remain unchanged'), 'UI states published source unchanged')
  assert(
    !ui.includes('Runtime approved') &&
      !ui.includes('Ready for execution') &&
      !ui.includes('Auto-generated source'),
    'forbidden UI language absent',
  )

  const hashA = computeSourceBlueprintAuditPackageHash({ b: 2, a: { d: 4, c: 3 } })
  const hashB = computeSourceBlueprintAuditPackageHash({ a: { c: 3, d: 4 }, b: 2 })
  assert(hashA === hashB, 'audit package hash is deterministic')

  console.log('✅ Sign-off schema + RLS')
  console.log('✅ Accepted suggestion requirement')
  console.log('✅ Audit package lineage/events/hash')
  console.log('✅ No runtime/publish/reconciliation mutation paths')
  console.log('✅ Coordinator UI language')
}

runChecks()
console.log('------------------------------------------------------------')
console.log('Source Blueprint Sign-off K4 smoke test passed.')
