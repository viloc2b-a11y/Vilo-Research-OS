/**
 * Phase 16E — CRA/monitor access boundary smoke (policy + DTO only).
 * Run: npx tsx scripts/phase16e-cra-access-boundary-smoke.ts
 */
import assert from 'node:assert/strict'
import type { OrganizationMembership } from '@/lib/auth/session'
import {
  assertCraCannotAccessInternalRuntime,
  assertCraRouteContext,
  canAccessInternalRuntimeAsMembership,
  canCreateFinding,
  canReadSubmittedSource,
  denyRuntimeIntelligenceAccess,
} from '@/lib/external-access/cra-access-policy'
import { DENIED_RUNTIME_TABLES } from '@/lib/external-access/denied-runtime-resources'
import {
  assertSourceReviewDtoHasNoInternalRuntimeFields,
  buildSourceReviewDto,
} from '@/lib/external-access/source-review-dto'
import {
  EXTERNAL_MONITOR_ROLE,
  isExternalActorOrganizationRole,
  isSiteInternalOrganizationRole,
} from '@/lib/rbac/external-actors'

const ORG = 'org-pilot'
const STUDY = 'study-pilot'

function membership(role: string): OrganizationMembership {
  return {
    organization_id: ORG,
    role,
    roles: [role],
    status: 'active',
    organizations: { id: ORG, name: 'Pilot' },
  }
}

function craCtx(studyRole: string | null = 'monitor'): Parameters<typeof canReadSubmittedSource>[0] {
  return {
    organizationId: ORG,
    studyId: STUDY,
    memberships: [membership('unblinded_cra')],
    studyMemberRole: studyRole,
    siteFindingsEnabled: false,
  }
}

function coordinatorCtx(): Parameters<typeof canReadSubmittedSource>[0] {
  return {
    organizationId: ORG,
    studyId: STUDY,
    memberships: [membership('research_coordinator')],
    studyMemberRole: 'coordinator',
  }
}

function main() {
  const cra = craCtx()
  const coord = coordinatorCtx()

  assert.equal(isExternalActorOrganizationRole('unblinded_cra'), true)
  assert.equal(isExternalActorOrganizationRole(EXTERNAL_MONITOR_ROLE.CRA_MONITOR), true)
  assert.equal(isSiteInternalOrganizationRole('research_coordinator'), true)

  assert.equal(denyRuntimeIntelligenceAccess(cra), true)
  assert.equal(canReadSubmittedSource(cra), true)
  assert.equal(canCreateFinding(cra), false)
  assert.equal(canCreateFinding({ ...cra, siteFindingsEnabled: true }), true)

  for (const table of DENIED_RUNTIME_TABLES) {
    const violation = assertCraCannotAccessInternalRuntime(table, cra)
    assert.ok(violation, `CRA must be denied: ${table}`)
    assert.equal(violation?.code, 'CRA_RUNTIME_INTELLIGENCE_DENIED')
  }

  assert.equal(assertCraCannotAccessInternalRuntime('runtime_traces', coord), null)
  assert.equal(canAccessInternalRuntimeAsMembership(coord.memberships, ORG), true)

  const routeOk = assertCraRouteContext(cra)
  assert.equal(routeOk.ok, true)
  const routeBad = assertCraRouteContext(coord)
  assert.equal(routeBad.ok, false)

  const dto = buildSourceReviewDto({
    response_set_id: 'rs-1',
    study_id: STUDY,
    subject_display_code: 'SUBJ-001',
    visit_label: 'Visit 1',
    procedure_label: 'Vitals',
    procedure_execution_status: 'submitted',
    fields: [{ field_label: 'Weight', submitted_value: 72 }],
    submitted_at: '2026-05-23T12:00:00Z',
    submitted_by_role: 'research_coordinator',
    correction_status: 'approved_correction',
  })
  const dtoCheck = assertSourceReviewDtoHasNoInternalRuntimeFields(dto)
  assert.equal(dtoCheck.ok, true)
  assert.equal('integrity_hash' in dto, false)
  assert.equal('workflow_telemetry_events' in dto, false)

  const polluted = {
    ...dto,
    workflow_telemetry_events: [],
    coordinator_orchestration: { burden: 9 },
  }
  const pollutedCheck = assertSourceReviewDtoHasNoInternalRuntimeFields(polluted)
  assert.equal(pollutedCheck.ok, false)

  console.log('phase16e-cra-access-boundary-smoke: PASS')
}

main()
