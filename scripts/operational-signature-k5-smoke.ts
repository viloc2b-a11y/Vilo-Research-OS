/**
 * K5 smoke: Operational eSignature runtime foundation.
 * Static and pure-function checks for the signature layer boundary.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  OPERATIONAL_SIGNATURE_TEST_FIXTURE_ARTIFACT_TYPE,
  loadOperationalSignatureArtifactForHash,
} from '../lib/operational-signatures/artifact-loader'
import { computeOperationalArtifactHash } from '../lib/operational-signatures/artifact-hash'
import { OPERATIONAL_SIGNATURE_WARNING } from '../lib/operational-signatures/operational-signature-types'
import { validateSignerAuthorization } from '../lib/operational-signatures/validate-signer-authorization'
import type { OrganizationMembership } from '../lib/auth/session'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function assertContainsAll(content: string, tokens: string[], label: string) {
  for (const token of tokens) {
    assert(content.includes(token), `${label} missing ${token}`)
  }
}

function assertNoForbiddenMutation(relativePath: string) {
  const content = read(relativePath)
  const forbidden = [
    "from('source_blueprint_draft_signoffs')",
    "from('source_blueprint_audit_exports')",
    "from('source_blueprint_evidence')",
    "from('runtime_source_package_publications')",
    "from('published_source_definition_versions')",
    "from('published_source_sections')",
    "from('published_source_fields')",
    "from('visit_instances')",
    "from('visit_procedure_instances')",
    'publish_source_package',
    'approveReconciliation',
  ]
  for (const token of forbidden) {
    assert(!content.includes(token), `${relativePath} must not contain ${token}`)
  }
}

function membership(role: string, roles: string[] = []): OrganizationMembership {
  return {
    organization_id: '00000000-0000-0000-0000-000000000001',
    role,
    roles,
    status: 'active',
    organizations: null,
  }
}

function fixtureRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    organizationId: '00000000-0000-0000-0000-000000000001',
    studyId: '00000000-0000-0000-0000-000000000002',
    subjectId: null,
    visitId: null,
    sourcePackageId: null,
    publishedSourceId: null,
    lockedSnapshotId: null,
    artifactType: OPERATIONAL_SIGNATURE_TEST_FIXTURE_ARTIFACT_TYPE,
    artifactId: '00000000-0000-0000-0000-000000000003',
    requiredRole: 'pi_sub_i',
    signatureMeaning: 'reviewed_by',
    status: 'pending',
    requestedBy: null,
    requestedAt: new Date(0).toISOString(),
    expiresAt: null,
    metadata: {
      operational_signature_test_fixture: {
        server_loaded: true,
        client_supplied: false,
      },
    },
    ...overrides,
  } as Parameters<typeof loadOperationalSignatureArtifactForHash>[1]
}

async function runChecks() {
  console.log('--- Operational eSignature K5 checks ---')

  const migration = [
    read('supabase/migrations/0133_operational_signature_runtime.sql'),
    read('supabase/migrations/0134_operational_signature_runtime_hardening.sql'),
  ].join('\n')
  assertContainsAll(
    migration,
    [
      'operational_signature_requests',
      'operational_signatures',
      'operational_signature_events',
      'organization_id',
      'study_id',
      'subject_id',
      'visit_id',
      'source_package_id',
      'published_source_id',
      'locked_snapshot_id',
      'artifact_type',
      'artifact_id',
      'required_role',
      'signer_user_id',
      'signer_role',
      'signature_meaning',
      'signed_artifact_hash',
      'signed_at',
      'ip_address',
      'user_agent',
      'status',
      'metadata jsonb',
    ],
    'migration',
  )
  assertContainsAll(
    migration,
    [
      'completed_by',
      'reviewed_by',
      'approved_by',
      'acknowledged_by',
      'pi_review',
      'si_review',
      'query_closure',
      'lock_approval',
    ],
    'signature meanings',
  )
  assert(
    migration.includes('operational_signatures_deny_completed_mutation'),
    'completed signatures cannot be updated/deleted',
  )
  assert(
    migration.includes('operational_signature_events_deny_mutation'),
    'audit events are append-only',
  )
  assert(migration.includes('user_has_study_access(study_id)'), 'RLS uses study access')
  assert(
    migration.includes('operational_signature_assert_study_org_scope'),
    'DB rejects cross-org/study mismatch',
  )
  assert(
    migration.includes('operational_signature_requests_pending_unique_idx'),
    'duplicate pending request identity is rejected',
  )
  assert(
    migration.includes("where status = 'pending'"),
    'completed/cancelled/superseded requests do not block new requests',
  )

  const createRequest = read('lib/operational-signatures/create-signature-request.ts')
  assert(
    createRequest.includes("from('operational_signature_requests')"),
    'request creation writes request table',
  )
  assert(createRequest.includes('signature_request_created'), 'request creation appends event')
  assert(
    createRequest.includes('assertOperationalSignatureStudyScope'),
    'service rejects cross-org/study mismatch before insert',
  )

  const signSource = read('lib/operational-signatures/sign-artifact.ts')
  assert(
    signSource.includes('OPERATIONAL_SIGNATURE_WARNING'),
    'signing requires warning confirmation',
  )
  assert(signSource.includes('validateSignerAuthorization'), 'signing validates role authorization')
  assert(
    signSource.includes('loadOperationalSignatureArtifactForHash'),
    'signing loads artifact server-side',
  )
  assert(signSource.includes('computeOperationalArtifactHash'), 'signing hashes artifact before record')
  assert(signSource.includes("from('operational_signatures')"), 'signing writes signature record')
  assert(signSource.includes('signature_recorded'), 'signing appends audit event')
  assert(!signSource.includes('artifactSnapshot'), 'signing does not trust client artifact snapshot')
  assertContainsAll(
    signSource,
    [
      'signature_id',
      'request_id',
      'artifact_type',
      'artifact_id',
      'signer_user_id',
      'signer_role',
      'required_role',
      'signature_meaning',
      'delegation_matched',
      'signed_artifact_hash',
      'ip_address',
      'user_agent',
      'signed_at',
    ],
    'signature_recorded event payload',
  )

  for (const relativePath of [
    'lib/operational-signatures/create-signature-request.ts',
    'lib/operational-signatures/sign-artifact.ts',
    'app/api/operational-signatures/request/route.ts',
    'app/api/operational-signatures/[id]/sign/route.ts',
  ]) {
    assertNoForbiddenMutation(relativePath)
  }

  const orgId = '00000000-0000-0000-0000-000000000001'
  const unauthorized = validateSignerAuthorization({
    memberships: [membership('research_coordinator')],
    organizationId: orgId,
    requiredRole: 'pi_sub_i',
  })
  const authorized = validateSignerAuthorization({
    memberships: [membership('pi_sub_i')],
    organizationId: orgId,
    requiredRole: 'pi_sub_i',
  })
  const adminOverride = validateSignerAuthorization({
    memberships: [membership('admin')],
    organizationId: orgId,
    requiredRole: 'pi_sub_i',
  })
  assert(!unauthorized.ok, 'unauthorized role cannot sign')
  assert(authorized.ok && authorized.signerRole === 'pi_sub_i', 'exact role signer can sign')
  assert(!adminOverride.ok, 'admin/owner override is rejected without exact role')

  const hashA = computeOperationalArtifactHash({ b: 2, a: { d: 4, c: 3 } })
  const hashB = computeOperationalArtifactHash({ a: { c: 3, d: 4 }, b: 2 })
  assert(hashA === hashB && hashA.length === 64, 'signed artifact hash is deterministic')

  let unsupportedBlocked = false
  try {
    await loadOperationalSignatureArtifactForHash(
      {} as SupabaseClient,
      fixtureRequest({ artifactType: 'completed_source_section' }),
    )
  } catch {
    unsupportedBlocked = true
  }
  assert(unsupportedBlocked, 'unsupported artifact type cannot be signed')

  const loadedFixture = await loadOperationalSignatureArtifactForHash(
    {} as SupabaseClient,
    fixtureRequest(),
  )
  assert(
    loadedFixture.payload.server_loaded === true &&
      loadedFixture.payload.client_supplied === false,
    'supported fixture hash payload is loaded server-side',
  )

  const typeSource = read('lib/operational-signatures/operational-signature-types.ts')
  assert(typeSource.includes(OPERATIONAL_SIGNATURE_WARNING), 'shared warning constant is exact')

  const ui = read('components/operational-signatures/operational-signatures-client.tsx')
  assertContainsAll(
    ui,
    [
      'Pending Signatures',
      'Signature Meaning',
      'Review Before Signing',
      'Sign Electronically',
      'Signature Audit Trail',
      'OPERATIONAL_SIGNATURE_WARNING',
    ],
    'UI',
  )
  assert(!ui.includes('artifact_snapshot'), 'client does not send signed hash payload')
  for (const forbidden of [
    ['Part 11', ' certified'].join(''),
    ['legally', ' equivalent'].join(''),
    ['auto', '-signed'].join(''),
    ['AI', ' signed'].join(''),
    ['system', ' approved'].join(''),
  ]) {
    assert(!ui.includes(forbidden), `UI must not include ${forbidden}`)
  }

  const packageJson = read('package.json')
  assert(packageJson.includes('operational-signature:smoke'), 'smoke script is registered')

  console.log('OK Operational signature tables + append-only audit')
  console.log('OK Org/study scope, duplicate pending guard, and exact-role signing')
  console.log('OK Server-side artifact loading and deterministic hashing')
  console.log('OK No evidence/signoff/runtime publication mutation paths')
  console.log('OK Coordinator UI language')
}

runChecks()
  .then(() => {
    console.log('------------------------------------------------------------')
    console.log('Operational eSignature K5 smoke test passed.')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
