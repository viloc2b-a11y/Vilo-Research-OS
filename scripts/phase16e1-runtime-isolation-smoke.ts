/**
 * Phase 16E-1 — External runtime isolation smoke.
 * Run: npx tsx scripts/phase16e1-runtime-isolation-smoke.ts
 */
import assert from 'node:assert/strict'
import type { OrganizationMembership } from '../lib/auth/session'
import type { ResponseSetDetailData } from '../lib/api/source/read-types'
import {
  assertExternalDtoOnlyResponse,
  assertResponseSetStatusReleasableToExternal,
  assertRuntimeProjectionQueryAllowed,
  assertSourceReviewDtoHasNoInternalRuntimeFields,
  classifyActorForOrganization,
  denyExternalRawSourceRead,
  denyExternalReplayRead,
  denyExternalSourceMutation,
  mapResponseSetDetailToSourceReviewDto,
  RUNTIME_ISOLATION_CODE,
  RuntimeIsolationError,
} from '../lib/external-access'
import { DENIED_RUNTIME_TABLES } from '../lib/external-access/denied-runtime-resources'

function membership(role: string, org = 'org-1'): OrganizationMembership {
  return {
    organization_id: org,
    role,
    roles: [role],
    status: 'active',
    organizations: { id: org, name: 'Site' },
  }
}

function main() {
  const cra = [membership('unblinded_cra')]
  const coordinator = [membership('research_coordinator')]
  const uncertain = [membership('unknown_role_xyz')]

  const craActor = classifyActorForOrganization(cra, 'org-1')
  const internalActor = classifyActorForOrganization(coordinator, 'org-1')
  const uncertainActor = classifyActorForOrganization(uncertain, 'org-1')

  assert.equal(craActor.isExternalActor, true)
  assert.equal(craActor.mayAccessInternalRuntime, false)
  assert.equal(internalActor.mayAccessInternalRuntime, true)
  assert.equal(uncertainActor.kind, 'uncertain')
  assert.equal(uncertainActor.mayAccessInternalRuntime, false)

  for (const table of DENIED_RUNTIME_TABLES) {
    assert.throws(
      () => assertRuntimeProjectionQueryAllowed(table, craActor),
      RuntimeIsolationError,
    )
    assert.doesNotThrow(() => assertRuntimeProjectionQueryAllowed(table, internalActor))
  }

  assert.throws(() => denyExternalRawSourceRead(craActor), RuntimeIsolationError)
  assert.throws(() => denyExternalReplayRead(craActor), RuntimeIsolationError)
  assert.throws(() => denyExternalSourceMutation(craActor), RuntimeIsolationError)
  assert.doesNotThrow(() => denyExternalRawSourceRead(internalActor))

  const detail: ResponseSetDetailData = {
    response_set: {
      id: 'rs-1',
      organization_id: 'org-1',
      study_id: 'study-1',
      study_version_id: null,
      study_subject_id: 'subj-1',
      visit_id: 'visit-1',
      procedure_execution_id: 'pe-1',
      source_definition_version_id: 'ver-1',
      status: 'submitted',
      source_origin: 'site',
      opened_by_user_id: 'u1',
      opened_at: '2026-05-01T10:00:00Z',
      submitted_by_user_id: 'u2',
      submitted_at: '2026-05-02T10:00:00Z',
      reviewed_by_user_id: null,
      reviewed_at: null,
      signed_by_user_id: null,
      signed_at: null,
      locked_by_user_id: null,
      locked_at: null,
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-02T10:00:00Z',
    },
    fields: [
      {
        source_field_id: 'f1',
        field_key: 'weight_kg',
        widget_hint: null,
        is_required: true,
        current_effective: {
          response_id: 'r1',
          response_sequence: 1,
          is_submitted: true,
          captured_at: '2026-05-02T09:00:00Z',
          submitted_at: '2026-05-02T10:00:00Z',
          originator_user_id: 'u2',
          originator_role: 'research_coordinator',
          supersedes_response_id: null,
          value: { value_number: 72 },
        },
        history: [],
      },
    ],
    corrections: [],
    addenda: [],
    findings_summary: { active: [], counts: { total: 0, open: 0, acknowledged: 0, resolved: 0, waived: 0, severity: { info: 0, warning: 0, error: 0 } } },
    placeholders: {},
    lineage: {
      immutable_append_only: true,
      history_rpc: 'get_source_response_set_history',
      chronology_ref: { organization_id: 'org-1', source_response_set_id: 'rs-1' },
    },
  }

  const dto = mapResponseSetDetailToSourceReviewDto(detail)
  assert.equal('lineage' in dto, false)
  assert.equal('structured_payload' in dto, false)
  assert.equal('operational_event_id' in dto, false)
  assertExternalDtoOnlyResponse(dto)
  const leakCheck = assertSourceReviewDtoHasNoInternalRuntimeFields(dto)
  assert.equal(leakCheck.ok, true)

  const polluted = { ...dto, workflow_telemetry_events: [] }
  const pollutedCheck = assertSourceReviewDtoHasNoInternalRuntimeFields(polluted)
  assert.equal(pollutedCheck.ok, false)

  assert.throws(
    () => assertResponseSetStatusReleasableToExternal('draft'),
    (err: unknown) =>
      err instanceof RuntimeIsolationError
      && err.code === RUNTIME_ISOLATION_CODE.SOURCE_NOT_RELEASED,
  )

  console.log('phase16e1-runtime-isolation-smoke: PASS')
}

main()
